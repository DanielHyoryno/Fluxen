const test = require("node:test");
const assert = require("node:assert/strict");

process.env.BUSINESS_TIMEZONE = "Asia/Jakarta";
const { formatBusinessDateTime, toBusinessDateKey, toBusinessMonthKey } = require("../src/utils/datetime");

test("WIB date keys cross midnight at 17:00 UTC", () => {
    assert.equal(toBusinessDateKey("2026-07-11T16:59:59.000Z"), "2026-07-11");
    assert.equal(toBusinessDateKey("2026-07-11T17:00:00.000Z"), "2026-07-12");
    assert.equal(toBusinessMonthKey("2026-07-31T17:00:00.000Z"), "2026-08");
    assert.equal(formatBusinessDateTime("2026-07-11T17:00:00.000Z"), "2026-07-12 00:00:00 WIB");
});
