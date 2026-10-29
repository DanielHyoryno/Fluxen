// Real HTTP + real local PostgreSQL. Refuses non-local databases, uses a fresh
// process-specific schema, never sends push notifications, never contacts IoT.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const out = process.env.BLACKBOX_EVIDENCE_DIR || path.join(root, "output/testing/2026-10-29");
const url = new URL(process.env.TEST_DATABASE_URL || "postgresql://fluxen_test@127.0.0.1:55439/postgres");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Only localhost is permitted");
const schema = `fluxen_blackbox_${process.pid}_test`;
assert.match(schema, /^[a-z][a-z0-9_]*_test$/);
Object.assign(process.env, { NODE_ENV: "test", DATABASE_URL: url.toString(), DB_SCHEMA: schema,
    DB_SSL: "false", JWT_SECRET: "local-blackbox-only-not-production", JWT_EXPIRES_IN: "7d",
    BUSINESS_TIMEZONE: "Asia/Jakarta", PUSH_NOTIFICATIONS_ENABLED: "false", EXPO_ACCESS_TOKEN: "" });
const { Pool } = require("pg");
const ExcelJS = require("exceljs");
const results = [];
let server, pool, bootstrap, base, token, createdSchema = false;
async function req(endpoint, method = "GET", body, bearer = token) {
    const response = await fetch(`${base}${endpoint}`, { method,
        headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
}
async function check(id, title, fn) {
    const start = Date.now();
    try { const actual = await fn(); results.push({ id, title, status: "passed", actual, ms: Date.now() - start }); }
    catch (error) { results.push({ id, title, status: "failed", actual: String(error.message), ms: Date.now() - start }); }
    console.log(`${results.at(-1).status.toUpperCase()} ${id} ${title}`);
}
async function main() {
    fs.mkdirSync(out, { recursive: true });
    bootstrap = new Pool({ connectionString: url.toString(), ssl: false });
    await bootstrap.query(`CREATE SCHEMA ${schema}`); createdSchema = true;
    pool = require("../src/config/db");
    await pool.query(fs.readFileSync(path.join(root, "backend/tests/fixtures/schema.sql"), "utf8"));
    const app = require("../src/app");
    await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
    base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const registration = { full_name: "Pengguna Uji", email: "blackbox@example.test", password: "password123" };
    await check("BB-REG-001", "registrasi HTTP nyata", async () => {
        const r = await req("/auth/register", "POST", registration, null);
        assert.equal(r.status, 201); assert.equal(r.body.data.user.email, registration.email);
        token = r.body.data.access_token; assert.ok(token);
        return "HTTP 201; akun lokal dibuat dan email sesuai.";
    });
    assert.ok(token, "Cannot continue without the local account");
    await check("BB-REG-002", "duplikasi email", async () => {
        const r = await req("/auth/register", "POST", registration, null);
        assert.equal(r.status, 409); assert.equal(r.body.error_code, "EMAIL_ALREADY_USED");
        return "HTTP 409; Email already used.";
    });
    await check("BB-AUT-001", "login valid", async () => {
        const r = await req("/auth/login", "POST", { email: registration.email, password: registration.password }, null);
        assert.equal(r.status, 200); assert.equal(r.body.data.user.email, registration.email);
        return "HTTP 200; akun yang benar dikembalikan.";
    });
    await check("BB-AUT-002", "login salah", async () => {
        const r = await req("/auth/login", "POST", { email: registration.email, password: "wrong-password" }, null);
        assert.equal(r.status, 401); assert.equal(r.body.error_code, "INVALID_CREDENTIALS");
        return "HTTP 401; Invalid email or password.";
    });
    await check("BB-AUT-003", "validasi login", async () => {
        for (const body of [{ email: "", password: "valid" }, { email: "invalid", password: "valid" }, { email: registration.email, password: "" }]) {
            assert.equal((await req("/auth/login", "POST", body, null)).status, 422);
        }
        return "Email kosong, format salah, dan password kosong: HTTP 422.";
    });
    const categoryA = (await req("/categories", "POST", { name: "Dapur" })).body.data.id;
    const categoryB = (await req("/categories", "POST", { name: "Taman" })).body.data.id;
    await check("BB-KAT-001", "kategori valid dan nilai batas", async () => {
        for (const name of ["AB", "X".repeat(80)]) assert.equal((await req("/categories", "POST", { name })).status, 201);
        return "Nama 2 dan 80 karakter diterima (HTTP 201).";
    });
    await check("BB-KAT-002", "kategori tidak valid", async () => {
        for (const name of ["", " ", "A", "X".repeat(81)]) assert.equal((await req("/categories", "POST", { name })).status, 422);
        return "Kosong, spasi, 1 dan 81 karakter ditolak (HTTP 422).";
    });
    await check("BB-KAT-003", "duplikasi kategori", async () => {
        for (const name of ["dapur", "  Dapur  "]) {
            const r = await req("/categories", "POST", { name }); assert.equal(r.status, 409); assert.equal(r.body.error_code, "CATEGORY_ALREADY_EXISTS");
        }
        return "Perbedaan kapitalisasi maupun spasi: HTTP 409 CATEGORY_ALREADY_EXISTS.";
    });
    await check("BB-KAT-004", "ubah kategori", async () => {
        assert.equal((await req(`/categories/${categoryA}`, "PATCH", { name: "Dapur Baru" })).status, 200);
        const items = (await req("/categories")).body.data.items;
        assert.ok(items.some(x => x.name === "Dapur Baru")); return "Nama Dapur Baru tersimpan dan muncul pada GET daftar.";
    });
    await check("BB-KAT-005", "ubah menjadi kategori duplikat", async () => {
        assert.equal((await req(`/categories/${categoryA}`, "PATCH", { name: "Taman" })).status, 409);
        return "Perubahan ke nama Taman ditolak (HTTP 409).";
    });
    const d1 = (await req("/devices", "POST", { device_code: "BB-DAPUR", device_name: "Meter Dapur", category_id: categoryA })).body.data;
    const d2 = (await req("/devices", "POST", { device_code: "BB-TAMAN", device_name: "Meter Taman", category_id: categoryB })).body.data;
    const d3 = (await req("/devices", "POST", { device_code: "BB-BEBAS", device_name: "Meter Bebas" })).body.data;
    await check("BB-DEV-001", "perangkat berkategori", async () => {
        assert.ok(d1.id && d1.api_token); const item = (await req("/devices")).body.data.items.find(x => String(x.id) === String(d1.id));
        assert.equal(String(item.category_id), String(categoryA)); return "Perangkat berkategori tampil; token baru diberikan oleh server lokal.";
    });
    await check("BB-DEV-002", "perangkat tanpa kolom opsional", async () => {
        const item = (await req("/devices")).body.data.items.find(x => String(x.id) === String(d3.id));
        assert.equal(item.category_id, null); assert.equal(item.install_location, null); return "Kategori dan lokasi null pada daftar perangkat lokal.";
    });
    await check("BB-DEV-003", "kode di luar batas", async () => {
        for (const code of ["", "AB", "C".repeat(51)]) assert.equal((await req("/devices", "POST", { device_code: code, device_name: "Meter" })).status, 422);
        return "Kode kosong, 2 dan 51 karakter: HTTP 422.";
    });
    await check("BB-DEV-004", "kode tepat batas", async () => {
        for (const code of ["ABC", "C".repeat(50)]) assert.equal((await req("/devices", "POST", { device_code: code, device_name: "Meter" })).status, 201);
        return "Kode 3 dan 50 karakter: HTTP 201.";
    });
    await check("BB-DEV-005", "nama perangkat di luar batas", async () => {
        for (const name of ["", "A", "N".repeat(101)]) assert.equal((await req("/devices", "POST", { device_code: "INVALID-NAME", device_name: name })).status, 422);
        return "Nama kosong, 1 dan 101 karakter: HTTP 422.";
    });
    await check("BB-DEV-006", "nama tepat batas", async () => {
        for (const n of [2, 100]) assert.equal((await req("/devices", "POST", { device_code: `NAME-${n}`, device_name: "N".repeat(n) })).status, 201);
        return "Nama 2 dan 100 karakter: HTTP 201.";
    });
    await check("BB-DEV-007", "lokasi tepat batas", async () => {
        assert.equal((await req("/devices", "POST", { device_code: "LOC-150", device_name: "Meter", install_location: "L".repeat(150) })).status, 201);
        return "Lokasi 150 karakter diterima (HTTP 201).";
    });
    await check("BB-DEV-008", "lokasi melebihi batas", async () => {
        assert.equal((await req("/devices", "POST", { device_code: "LOC-151", device_name: "Meter", install_location: "L".repeat(151) })).status, 422);
        return "Lokasi 151 karakter ditolak (HTTP 422).";
    });
    await check("BB-DEV-009", "kode duplikat", async () => {
        assert.equal((await req("/devices", "POST", { device_code: "BB-DAPUR", device_name: "Meter Lain" })).status, 409);
        return "Kode yang sudah dipakai ditolak (HTTP 409).";
    });
    await check("BB-DEV-010", "edit nama dan kosongkan lokasi", async () => {
        const r = await req(`/devices/${d1.id}`, "PATCH", { device_name: "Dapur Diperbarui", install_location: null, category_id: categoryB });
        assert.equal(r.status, 200); assert.equal(r.body.data.device_name, "Dapur Diperbarui"); assert.equal(r.body.data.install_location, null);
        assert.equal(String(r.body.data.category_id), String(categoryB)); return "Nama diperbarui, lokasi null, kategori berubah pada respons HTTP 200.";
    });
    await check("BB-DEV-011", "hapus kategori perangkat", async () => {
        const r = await req(`/devices/${d1.id}`, "PATCH", { category_id: null }); assert.equal(r.status, 200); assert.equal(r.body.data.category_id, null);
        await req(`/devices/${d1.id}`, "PATCH", { category_id: categoryA }); return "Perangkat dapat diubah ke kategori null (Uncategorized).";
    });
    await check("BB-KAT-008", "hapus kategori yang digunakan", async () => {
        const cat = (await req("/categories", "POST", { name: "Sementara" })).body.data.id;
        await req(`/devices/${d3.id}`, "PATCH", { category_id: cat });
        assert.equal((await req(`/categories/${cat}`, "DELETE")).status, 200);
        const item = (await req("/devices")).body.data.items.find(x => String(x.id) === String(d3.id)); assert.equal(item.category_id, null);
        return "Kategori dihapus; perangkat tetap ada dengan category_id null.";
    });
    await check("BB-LIM-001", "simpan dan baca batas positif", async () => {
        const body = { device_code: "BB-DAPUR", daily_usage_limit_l: 10, monthly_usage_limit_l: 100 };
        assert.equal((await req("/usage/limits", "PUT", body)).status, 200);
        const r = await req("/usage/limits?device_code=BB-DAPUR"); assert.equal(Number(r.body.data.daily_usage_limit_l), 10); assert.equal(Number(r.body.data.monthly_usage_limit_l), 100);
        return "Batas 10 L/hari dan 100 L/bulan tersimpan dan dapat dibaca ulang.";
    });
    await check("BB-LIM-002", "aktifkan salah satu batas", async () => {
        for (const [daily, monthly] of [[10, null], [null, 100]]) {
            assert.equal((await req("/usage/limits", "PUT", { device_code: "BB-DAPUR", daily_usage_limit_l: daily, monthly_usage_limit_l: monthly })).status, 200);
            const data = (await req("/usage/limits?device_code=BB-DAPUR")).body.data;
            assert.equal(data.daily_usage_limit_l === null ? null : Number(data.daily_usage_limit_l), daily);
            assert.equal(data.monthly_usage_limit_l === null ? null : Number(data.monthly_usage_limit_l), monthly);
        }
        return "Harian saja dan bulanan saja tersimpan dengan batas lainnya null.";
    });
    await check("BB-LIM-003", "nonaktifkan kedua batas", async () => {
        await req("/usage/limits", "PUT", { device_code: "BB-DAPUR", daily_usage_limit_l: null, monthly_usage_limit_l: null });
        const data = (await req("/usage/limits?device_code=BB-DAPUR")).body.data;
        assert.equal(data.daily_usage_limit_l, null); assert.equal(data.monthly_usage_limit_l, null); return "Kedua batas menjadi null.";
    });
    await check("BB-LIM-004", "batas nol negatif dan nonangka", async () => {
        for (const value of [0, -1, "abc"]) for (const field of ["daily_usage_limit_l", "monthly_usage_limit_l"]) {
            assert.equal((await req("/usage/limits", "PUT", { device_code: "BB-DAPUR", [field]: value })).status, 422);
        }
        return "Enam variasi nilai/kolom ditolak (HTTP 422).";
    });
    await check("BB-LIM-005", "batas desimal", async () => {
        assert.equal((await req("/usage/limits", "PUT", { device_code: "BB-DAPUR", daily_usage_limit_l: 10.5 })).status, 200);
        return "Batas desimal positif 10.5 diterima.";
    });
    const range = { from: "2026-10-01", to: "2026-10-31" };
    // Synthetic data inserted only into this disposable local schema.
    await pool.query("INSERT INTO measurements(device_id,measured_at,flow_rate_lpm,volume_delta_l) VALUES ($1,'2026-10-27T01:00:00Z',2,1),($1,'2026-10-27T02:00:00Z',3,2),($2,'2026-10-27T03:00:00Z',4,4)", [d1.id, d2.id]);
    await check("BB-BIL-006", "akun tanpa harga air", async () => {
        const r = await req("/billing/estimate", "POST", { ...range, device_ids: [Number(d1.id)] });
        assert.equal(r.status, 404); assert.equal(r.body.error_code, "BILLING_SETTINGS_NOT_FOUND"); return "HTTP 404 BILLING_SETTINGS_NOT_FOUND; estimasi tidak dibuat.";
    });
    await check("BB-BIL-001", "harga positif dan desimal", async () => {
        for (const price of [0.5, 10]) { const r = await req("/billing/settings", "PUT", { price_per_liter: price, currency: "IDR" }); assert.equal(r.status, 200); assert.equal(Number(r.body.data.price_per_liter), price); }
        return "Harga 0.5 dan 10 IDR/L tersimpan.";
    });
    await check("BB-BIL-002", "harga kosong nol negatif nonangka", async () => {
        for (const price of ["", 0, -1, "abc"]) assert.equal((await req("/billing/settings", "PUT", { price_per_liter: price, currency: "IDR" })).status, 422);
        return "Keempat variasi harga ditolak (HTTP 422).";
    });
    await check("BB-BIL-003", "estimasi satu dan beberapa perangkat", async () => {
        for (const [ids, liters, cost] of [[[d1.id], 3, 30], [[d1.id, d2.id], 7, 70]]) {
            const r = await req("/billing/estimate", "POST", { ...range, device_ids: ids.map(Number) }); assert.equal(r.status, 200);
            assert.equal(r.body.data.summary.total_liters, liters); assert.equal(r.body.data.summary.estimated_cost, cost);
            assert.equal(r.body.data.summary.device_count, ids.length);
        }
        return "Satu perangkat: 3 L/Rp30; dua perangkat: 7 L/Rp70 pada harga Rp10/L.";
    });
    await check("BB-BIL-004", "filter kategori", async () => {
        const r = await req("/billing/estimate", "POST", { ...range, category_id: Number(categoryA), device_ids: [Number(d1.id)] });
        assert.equal(r.status, 200); assert.equal(r.body.data.summary.total_liters, 3); assert.equal(r.body.data.items.length, 1);
        return "Kategori Dapur hanya menghasilkan 1 perangkat, 3 L, Rp30.";
    });
    await check("BB-BIL-005", "tanpa pilihan perangkat dan tanpa data", async () => {
        let r = await req("/billing/estimate", "POST", { ...range, device_ids: [] }); assert.equal(r.status, 200);
        assert.equal(r.body.data.summary.device_count, 0); assert.equal(r.body.data.items.length, 0); assert.equal(r.body.data.summary.total_liters, 0);
        r = await req("/billing/estimate", "POST", { from: "2026-09-01", to: "2026-09-30", device_ids: [Number(d1.id)] });
        assert.equal(r.body.data.summary.device_count, 1); assert.equal(r.body.data.summary.estimated_cost, 0); assert.equal(r.body.data.items.length, 1);
        return "Tanpa pilihan: 0 perangkat/daftar kosong; tanpa data: 1 perangkat tetap tampil dengan biaya 0.";
    });
    await check("BB-BIL-008", "hitung ulang setelah harga berubah", async () => {
        await req("/billing/settings", "PUT", { price_per_liter: 20, currency: "IDR" });
        const r = await req("/billing/estimate", "POST", { ...range, device_ids: [Number(d1.id)] }); assert.equal(r.body.data.summary.estimated_cost, 60);
        return "Penggunaan 3 L berubah menjadi Rp60 pada harga Rp20/L.";
    });
    await check("BB-HIS-001", "riwayat penggunaan dari data dummy", async () => {
        const r = await req("/telemetry/history?device_code=BB-DAPUR&from=2026-10-01&to=2026-10-31"); assert.equal(r.status, 200);
        const row = r.body.data.items.find(x => String(x.date).startsWith("2026-10-27")); assert.ok(row); assert.equal(Number(row.total_liters), 3);
        return "Riwayat lokal tanggal 27 Oktober berisi 3 L.";
    });
    await check("BB-EXP-001", "workbook melalui endpoint ekspor", async () => {
        const response = await fetch(`${base}/telemetry/export-xlsx?device_code=BB-DAPUR&from=2026-10-01&to=2026-10-31`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 200); const buffer = Buffer.from(await response.arrayBuffer());
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
        assert.deepEqual(workbook.worksheets.map(x => x.name), ["Dashboard", "Daily Records"]);
        const daily = workbook.getWorksheet("Daily Records"); assert.equal(daily.rowCount, 2); assert.equal(daily.getCell("E2").value, 3);
        fs.writeFileSync(path.join(out, "contoh-laporan-dummy.xlsx"), buffer);
        return "XLSX nyata terbuka: Dashboard dan Daily Records; satu catatan harian berisi 3 L.";
    });
    await check("BB-EXP-002", "workbook periode kosong", async () => {
        const response = await fetch(`${base}/telemetry/export-xlsx?device_code=BB-DAPUR&from=2026-09-01&to=2026-09-30`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 200); const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
        assert.equal(workbook.getWorksheet("Daily Records").rowCount, 1); return "XLSX periode kosong tetap valid; Daily Records hanya berisi header.";
    });
    await check("BB-DEV-012", "hapus perangkat tanpa menunggu IoT", async () => {
        assert.equal((await req(`/devices/${d3.id}`, "DELETE")).status, 200);
        const items = (await req("/devices")).body.data.items; assert.ok(!items.some(x => String(x.id) === String(d3.id)));
        return "Perangkat tidak lagi muncul pada daftar. Reset fisik ESP32 tidak diuji.";
    });
}
main().catch(error => { results.push({ id: "HARNESS", status: "failed", actual: String(error.message) }); })
    .finally(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool) await pool.end();
        if (createdSchema && bootstrap) await bootstrap.query(`DROP SCHEMA ${schema} CASCADE`);
        if (bootstrap) await bootstrap.end();
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, "api-observations.json"), JSON.stringify({ environment: "localhost PostgreSQL, disposable schema; no physical IoT, no external push", results }, null, 2));
        const failed = results.filter(x => x.status === "failed");
        console.log(`Local API: ${results.length - failed.length} passed, ${failed.length} failed`);
        process.exitCode = failed.length ? 1 : 0;
    });
