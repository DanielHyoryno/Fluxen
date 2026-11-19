const assert = require("node:assert/strict");
const createSession = require("./review-session.cjs");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function run() {
    const appOrigin = process.env.REPORT_EMAIL_PREVIEW_URL || "http://localhost:8081";
    const { browser, context, page, errors, output } = await createSession(playwright, process.env.CHROME_EXECUTABLE, { appOrigin });
    const email = "contoh@fluxen.test";
    const device = { id: 1, device_code: "METER-01", device_name: "Meter air dapur dan ruang cuci lantai bawah", category_id: 1, status: "online" };
    const json = (route, data) => route.fulfill({ json: { success: true, data }, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } });
    let verified = false;
    let sent = false;
    await context.route("http://localhost:8099/api/v1/devices/1", (route) => json(route, device));
    await context.route("http://localhost:8099/api/v1/report-email/**", async (route) => {
        if (route.request().method() === "OPTIONS") return json(route, {});
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/status") || path.endsWith("/verification")) return json(route, { email, verified });
        if (path.endsWith("/confirm")) {
            assert.equal(route.request().postDataJSON().code, "123456");
            verified = true;
        } else {
            assert.equal(verified, true);
            assert.equal(route.request().postDataJSON().device_code, device.device_code);
            sent = true;
        }
        return json(route, { email, verified });
    });
    try {
        await page.goto(appOrigin, { timeout: 120000 });
        async function openHistory() {
            await page.getByRole("tab", { name: "Perangkat", exact: true }).click({ timeout: 90000 });
            await page.getByText(device.device_name, { exact: true }).click();
            await page.getByText("Riwayat pemakaian", { exact: true }).last().click();
        }
        await openHistory();
        const action = page.getByTestId("report-email-action");
        const panel = action.locator("..");
        const send = page.getByRole("button", { name: "Kirim XLSX ke email saya" });
        await send.waitFor();
        await panel.screenshot({ path: `${output}/report-email-button.png` });
        await send.click();
        await page.getByRole("button", { name: "Buka Profil" }).click();
        await page.getByRole("button", { name: "Verifikasi email", exact: true }).click();
        await page.getByLabel("Kode verifikasi", { exact: true }).waitFor();
        await action.filter({ has: page.getByLabel("Kode verifikasi", { exact: true }) })
            .locator("..").screenshot({ path: `${output}/report-email-otp.png` });
        await page.getByLabel("Kode verifikasi", { exact: true }).fill("123456");
        await page.getByRole("button", { name: "Verifikasi kode", exact: true }).click();
        await page.getByText("Email akun sudah terverifikasi.").waitFor();
        await page.reload();
        await openHistory();
        await send.click();
        await page.getByText(/Laporan diajukan untuk dikirim/).waitFor();
        await panel.screenshot({ path: `${output}/report-email-result.png` });
        assert.equal(sent, true);
        assert.deepEqual(errors, []);
        console.log("PASS: captured report-email button, OTP, and simulated sending.");
    } finally {
        await browser.close();
    }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
