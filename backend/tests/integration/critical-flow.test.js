const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");

require("dotenv").config({ path: path.join(__dirname, "../../.env.test") });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseSchema = process.env.TEST_DATABASE_SCHEMA;
let pool;
let server;
let baseUrl;

async function request(pathname, { method = "GET", token, body } = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    return { status: response.status, payload };
}

if (testDatabaseUrl)
    before(async () => {
        const parsedUrl = new URL(testDatabaseUrl);
        assert.match(
            parsedUrl.hostname,
            /^(localhost|127\.0\.0\.1|::1)$/,
            "Integration tests only accept a local PostgreSQL host"
        );
        assert.match(testDatabaseSchema || "", /^[a-z][a-z0-9_]*_test$/, "TEST_DATABASE_SCHEMA must end with _test");

        const { Pool } = require("pg");
        const bootstrapPool = new Pool({ connectionString: testDatabaseUrl, ssl: false });
        await bootstrapPool.query(`DROP SCHEMA IF EXISTS ${testDatabaseSchema} CASCADE`);
        await bootstrapPool.query(`CREATE SCHEMA ${testDatabaseSchema}`);
        await bootstrapPool.end();

        process.env.NODE_ENV = "test";
        process.env.DATABASE_URL = parsedUrl.toString();
        process.env.DB_SCHEMA = testDatabaseSchema;
        process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret";
        process.env.BUSINESS_TIMEZONE = "Asia/Jakarta";
        process.env.DB_SSL = process.env.DB_SSL || "false";

        pool = require("../../src/config/db");
        const schema = fs.readFileSync(path.join(__dirname, "../fixtures/schema.sql"), "utf8");
        await pool.query(schema);

        const app = require("../../src/app");
        await new Promise((resolve) => {
            server = app.listen(0, "127.0.0.1", resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
    });

if (testDatabaseUrl)
    after(async () => {
        if (server)
            await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        if (pool) await pool.end();

        const { Pool } = require("pg");
        const cleanupPool = new Pool({ connectionString: testDatabaseUrl, ssl: false });
        await cleanupPool.query(`DROP SCHEMA IF EXISTS ${testDatabaseSchema} CASCADE`);
        await cleanupPool.end();
    });

test("critical API flow uses WIB boundaries and enforces ownership", { skip: !testDatabaseUrl }, async () => {
    const register = await request("/auth/register", {
        method: "POST",
        body: { full_name: "Integration Owner", email: "owner@test.local", password: "password123" },
    });
    assert.equal(register.status, 201);
    const ownerToken = register.payload.data.access_token;

    const homeCategory = await request("/categories", {
        method: "POST",
        token: ownerToken,
        body: { name: "Home" },
    });
    assert.equal(homeCategory.status, 201);

    const duplicateCategory = await request("/categories", {
        method: "POST",
        token: ownerToken,
        body: { name: " home " },
    });
    assert.equal(duplicateCategory.status, 409);
    assert.equal(duplicateCategory.payload.error_code, "CATEGORY_ALREADY_EXISTS");

    const gardenCategory = await request("/categories", {
        method: "POST",
        token: ownerToken,
        body: { name: "Garden" },
    });
    assert.equal(gardenCategory.status, 201);

    const createDevice = await request("/devices", {
        method: "POST",
        token: ownerToken,
        body: {
            device_code: "TEST-ESP32-01",
            device_name: "Test Meter",
            category_id: homeCategory.payload.data.id,
        },
    });
    assert.equal(createDevice.status, 201);
    const deviceToken = createDevice.payload.data.api_token;
    const deviceId = createDevice.payload.data.id;

    const updateDeviceCategory = await request(`/devices/${deviceId}`, {
        method: "PATCH",
        token: ownerToken,
        body: { category_id: gardenCategory.payload.data.id },
    });
    assert.equal(updateDeviceCategory.status, 200);
    assert.equal(String(updateDeviceCategory.payload.data.category_id), String(gardenCategory.payload.data.id));
    assert.equal(updateDeviceCategory.payload.data.category_name, "Garden");

    const limits = await request("/usage/limits", {
        method: "PUT",
        token: ownerToken,
        body: { device_code: "TEST-ESP32-01", daily_usage_limit_l: 2.5, monthly_usage_limit_l: 100 },
    });
    assert.equal(limits.status, 200);

    const beforeMidnight = await request("/telemetry", {
        method: "POST",
        token: deviceToken,
        body: {
            device_code: "TEST-ESP32-01",
            measured_at: "2026-07-11T16:59:59.000Z",
            flow_rate_lpm: 1,
            volume_delta_l: 2,
        },
    });
    assert.equal(beforeMidnight.status, 201);
    assert.deepEqual(beforeMidnight.payload.data.alerts_triggered, []);

    const afterMidnight = await request("/telemetry/batch", {
        method: "POST",
        token: deviceToken,
        body: {
            device_code: "TEST-ESP32-01",
            records: [
                { measured_at: "2026-07-11T17:00:00.000Z", flow_rate_lpm: 1.5, volume_delta_l: 3 },
                { measured_at: "2026-07-11T17:00:00.000Z", flow_rate_lpm: 1.5, volume_delta_l: 3 },
            ],
        },
    });
    assert.equal(afterMidnight.status, 201);
    assert.equal(afterMidnight.payload.data.inserted_count, 1);
    assert.equal(afterMidnight.payload.data.duplicate_count, 1);
    assert.equal(afterMidnight.payload.data.alerts_triggered[0].period_key, "2026-07-12");

    const history = await request("/telemetry/history?device_code=TEST-ESP32-01&from=2026-07-11&to=2026-07-12", {
        token: ownerToken,
    });
    assert.equal(history.status, 200);
    assert.deepEqual(
        history.payload.data.items.map((row) => [String(row.date).slice(0, 10), Number(row.total_liters)]),
        [
            ["2026-07-11", 2],
            ["2026-07-12", 3],
        ]
    );

    const exportResponse = await fetch(
        `${baseUrl}/telemetry/export-xlsx?device_code=TEST-ESP32-01&from=2026-07-11&to=2026-07-12`,
        { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get("content-type"), /spreadsheetml/);
    const exportedWorkbook = new ExcelJS.Workbook();
    await exportedWorkbook.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));
    assert.deepEqual(
        exportedWorkbook.worksheets.map((sheet) => sheet.name),
        ["Dashboard", "Daily Records"]
    );
    assert.equal(exportedWorkbook.getWorksheet("Daily Records").getCell("B2").value, "Garden");
    assert.equal(exportedWorkbook.getWorksheet("Daily Records").getCell("E2").value, 2);
    assert.equal(exportedWorkbook.getWorksheet("Daily Records").getCell("E3").value, 3);

    const billingSettings = await request("/billing/settings", {
        method: "PUT",
        token: ownerToken,
        body: { price_per_liter: 10, currency: "IDR" },
    });
    assert.equal(billingSettings.status, 200);

    const estimate = await request("/billing/estimate", {
        method: "POST",
        token: ownerToken,
        body: { from: "2026-07-12", to: "2026-07-12", device_ids: [deviceId] },
    });
    assert.equal(estimate.status, 200);
    assert.equal(estimate.payload.data.summary.total_liters, 3);
    assert.equal(estimate.payload.data.summary.estimated_cost, 30);

    const secondUser = await request("/auth/register", {
        method: "POST",
        body: { full_name: "Other User", email: "other@test.local", password: "password123" },
    });
    assert.equal(secondUser.status, 201);

    const forbiddenRead = await request("/telemetry/latest?device_code=TEST-ESP32-01", {
        token: secondUser.payload.data.access_token,
    });
    assert.equal(forbiddenRead.status, 404);

    const wrongDeviceToken = await request("/telemetry", {
        method: "POST",
        token: "not-the-device-token",
        body: {
            device_code: "TEST-ESP32-01",
            measured_at: "2026-07-12T00:00:00.000Z",
            flow_rate_lpm: 1,
            volume_delta_l: 1,
        },
    });
    assert.equal(wrongDeviceToken.status, 401);

    const queuedRemoval = await request(`/devices/${deviceId}`, {
        method: "DELETE",
        token: ownerToken,
    });
    assert.equal(queuedRemoval.status, 200);
    assert.equal(queuedRemoval.payload.data.pending_reset, true);
    assert.equal(queuedRemoval.payload.data.command, "REPROVISION");

    const devicesAfterRemoval = await request("/devices", { token: ownerToken });
    assert.equal(devicesAfterRemoval.status, 200);
    assert.equal(devicesAfterRemoval.payload.data.items.some((item) => String(item.id) === String(deviceId)), false);

    const commandDelivery = await request("/telemetry/batch", {
        method: "POST",
        token: deviceToken,
        body: {
            device_code: "TEST-ESP32-01",
            records: [{ measured_at: "2026-07-12T00:01:00.000Z", flow_rate_lpm: 0, volume_delta_l: 0 }],
        },
    });
    assert.equal(commandDelivery.status, 201);
    assert.equal(commandDelivery.payload.data.command.type, "REPROVISION");

    const commandAck = await request("/telemetry/command-ack", {
        method: "POST",
        token: deviceToken,
        body: { device_code: "TEST-ESP32-01", command: "REPROVISION" },
    });
    assert.equal(commandAck.status, 200);
    assert.equal(commandAck.payload.data.reset_acknowledged, true);

    const deletedDeviceQ = await pool.query(`SELECT id FROM devices WHERE id = $1`, [deviceId]);
    const deletedMeasurementsQ = await pool.query(`SELECT id FROM measurements WHERE device_id = $1`, [deviceId]);
    assert.equal(deletedDeviceQ.rowCount, 0);
    assert.equal(deletedMeasurementsQ.rowCount, 0);

    const oldTokenAfterAck = await request("/telemetry", {
        method: "POST",
        token: deviceToken,
        body: {
            device_code: "TEST-ESP32-01",
            measured_at: "2026-07-12T00:02:00.000Z",
            flow_rate_lpm: 0,
            volume_delta_l: 0,
        },
    });
    assert.equal(oldTokenAfterAck.status, 401);

    const unknownRoute = await request("/does-not-exist", { token: ownerToken });
    assert.equal(unknownRoute.status, 404);
    assert.deepEqual(unknownRoute.payload, {
        success: false,
        error_code: "ROUTE_NOT_FOUND",
        message: "Route not found",
    });

    const invalidJsonResponse = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{invalid-json",
    });
    assert.equal(invalidJsonResponse.status, 400);
    assert.deepEqual(await invalidJsonResponse.json(), {
        success: false,
        error_code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
    });
});
