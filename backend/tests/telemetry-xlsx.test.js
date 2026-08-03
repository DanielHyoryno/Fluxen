const { test } = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { buildTelemetryWorkbook } = require("../src/services/telemetry-xlsx.service");

const sampleRows = [
    {
        date: "2026-08-01",
        device_code: "TEST-01",
        device_name: "Kitchen Meter",
        category_name: "Kitchen",
        total_liters: "2.00",
        avg_flow_rate_lpm: "2.00",
        peak_flow_rate_lpm: "2.75",
        reading_count: "2",
    },
    {
        date: "2026-08-02",
        device_code: "TEST-01",
        device_name: "Kitchen Meter",
        category_name: "Kitchen",
        total_liters: "0.50",
        avg_flow_rate_lpm: "1.50",
        peak_flow_rate_lpm: "1.50",
        reading_count: "1",
    },
];

async function serializeAndReload(rows, from = "2026-08-01", to = "2026-08-31") {
    const workbook = buildTelemetryWorkbook({
        deviceCode: "TEST-01",
        from,
        to,
        rows,
        generatedAt: new Date("2026-08-03T00:00:00.000Z"),
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    return loaded;
}

test("telemetry XLSX provides filterable daily records with typed dates", async () => {
    const workbook = await serializeAndReload(sampleRows);

    assert.deepEqual(
        workbook.worksheets.map((sheet) => sheet.name),
        ["Dashboard", "Daily Records"]
    );

    const dashboard = workbook.getWorksheet("Dashboard");
    assert.equal(dashboard.getCell("A8").value.result, 2.5);
    assert.match(dashboard.getCell("A8").value.formula, /Daily Records/);
    assert.equal(dashboard.getCell("G5").value.hyperlink, "#'Daily Records'!A1");
    assert.equal(dashboard.getCell("A15").value, "Daily Usage Overview");

    const daily = workbook.getWorksheet("Daily Records");
    assert.equal(daily.getCell("B1").value, "Category");
    assert.equal(daily.getCell("B2").value, "Kitchen");
    assert.equal(daily.getCell("C2").value, "Kitchen Meter");
    assert.equal(daily.getCell("E2").value, 2);
    assert.equal(daily.getCell("E3").value, 0.5);
    assert.equal(daily.getCell("G2").value, 2.75);
    assert.ok(daily.getCell("A2").value instanceof Date);
    assert.equal(daily.getCell("A2").value.toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(daily.getCell("A2").numFmt, "yyyy-mm-dd");
    assert.equal(daily.getTables()[0].name, "DailyUsageTable");
    assert.equal(daily.getTables()[0].table.autoFilterRef, "A1:H3");
});

test("full-year XLSX uses a compact monthly dashboard overview", async () => {
    const workbook = await serializeAndReload(
        [
            sampleRows[0],
            { ...sampleRows[1], date: "2026-09-02", total_liters: "3.50" },
        ],
        "2026-01-01",
        "2026-12-31"
    );
    const dashboard = workbook.getWorksheet("Dashboard");
    assert.equal(dashboard.getCell("A15").value, "Monthly Usage Overview");
    assert.equal(dashboard.getCell("B17").value, 2);
    assert.equal(dashboard.getCell("B18").value, 3.5);
});

test("telemetry XLSX remains valid when the selected period has no readings", async () => {
    const workbook = await serializeAndReload([]);
    assert.equal(workbook.getWorksheet("Daily Records").rowCount, 1);
    assert.match(workbook.getWorksheet("Dashboard").getCell("A17").value, /No measurements/);
});
