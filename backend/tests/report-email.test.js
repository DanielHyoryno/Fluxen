const assert = require("node:assert/strict");
const { test } = require("node:test");
const ExcelJS = require("exceljs");
const { createReportEmailService } = require("../src/services/report-email.service");

const user = { id: 1, email: "owner@example.test" };
const report = { device_code: "METER-01", from: "2026-11-01", to: "2026-11-30", locale: "id" };
const settings = { enabled: true, otpSecret: "x".repeat(32), from: "local@example.test", apiKey: "fake" };

test("disabled delivery fails before any database or provider request", async () => {
    const service = createReportEmailService({ settings: { ...settings, enabled: false } });
    await assert.rejects(service.sendReport(user, report), { code: "REPORT_EMAIL_UNAVAILABLE" });
});

test("verification sends only a code and never stores it in plaintext", async () => {
    let storedDigest;
    let used = false;
    const mail = [];
    const service = createReportEmailService({ settings, sendMail: async (message) => mail.push(message),
        pool: { query: async (sql, args) => {
            assert.deepEqual(args.slice(0, 2), [user.id, user.email]);
            if (sql.startsWith("SELECT")) return { rows: [] };
            if (sql.startsWith("INSERT")) {
                storedDigest = args[2];
                return { rowCount: 1 };
            }
            const matched = !used && args[2] === storedDigest;
            if (matched) used = true;
            return { rows: [ { verified_at: matched ? new Date() : null } ] };
        } },
    });
    const result = await service.requestCode(user, "id");
    const code = mail[0].text.match(/\b\d{6}\b/)[0];
    assert.equal(mail[0].to, user.email);
    assert.equal(mail[0].attachment, undefined);
    assert.match(storedDigest, /^[0-9a-f]{64}$/);
    assert.deepEqual(result, { email: user.email, verified: false, expires_in_seconds: 600 });
    await assert.rejects(service.verifyCode(user, code === "000000" ? "000001" : "000000"), { code: "REPORT_EMAIL_CODE_INVALID" });
    assert.equal((await service.verifyCode(user, code)).verified, true);
    await assert.rejects(service.verifyCode(user, code), { code: "REPORT_EMAIL_CODE_INVALID" });
});

test("refuses unverified sends and uses account ownership, email and a real XLSX on verified sends", async () => {
    const mail = [];
    let verified = false;
    let permitted = false;
    const service = createReportEmailService({ settings, sendMail: async (message) => mail.push(message),
        pool: { query: async () => ({ rows: verified ? [{ verified_at: new Date() }] : [] }) },
        loadRows: async (...args) => {
            assert.deepEqual(args, [user.id, report.device_code, report.from, report.to]);
            if (!permitted) throw new Error("DEVICE_NOT_FOUND");
            return [];
        },
    });
    await assert.rejects(service.sendReport(user, report), { code: "REPORT_EMAIL_NOT_VERIFIED" });
    verified = true;
    await assert.rejects(service.sendReport(user, report), { message: "DEVICE_NOT_FOUND" });
    assert.equal(mail.length, 0);
    permitted = true;
    assert.deepEqual(await service.sendReport(user, { ...report, email: "not-the-owner@example.test" }), { email: user.email });
    assert.equal(mail[0].to, user.email);
    assert.equal(mail[0].attachment.filename, "METER-01_2026-11-01_2026-11-30.xlsx");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(mail[0].attachment.content);
    assert.equal(workbook.worksheets.length, 2);
});
