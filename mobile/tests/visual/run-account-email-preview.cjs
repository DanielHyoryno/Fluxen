const assert = require("node:assert/strict");
const createSession = require("./review-session.cjs");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function run() {
    const appOrigin = process.env.REPORT_EMAIL_PREVIEW_URL || "http://localhost:8081";
    const { browser, context, page, errors, output } = await createSession(playwright, process.env.CHROME_EXECUTABLE, { appOrigin, authenticated: false });
    const example = "contoh@fluxen.test";
    const resetToken = "preview-only";
    const code = "123456";
    const calls = [];
    const routes = {
        "/register": { email: example, verification_required: true },
        "/register/verify": { user: { email: example } },
        "/password-reset/request": { accepted: true },
        "/password-reset/verify": { reset_token: resetToken },
        "/password-reset/complete": { password_reset: true },
    };
    await context.route("http://localhost:8099/api/v1/auth/**", async (route) => {
        const endpoint = new URL(route.request().url()).pathname.replace("/api/v1/auth", "");
        const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        calls.push([endpoint, route.request().postDataJSON()]);
        return route.fulfill({ json: { success: true, data: routes[endpoint] }, headers });
    });
    try {
        await page.goto(appOrigin, { timeout: 120000 });
        await page.getByText("Belum punya akun? Daftar", { exact: true }).click({ timeout: 90000 });
        const inputs = page.locator("input:visible");
        await inputs.nth(0).fill("Akun Contoh");
        await inputs.nth(1).fill(example);
        await inputs.nth(2).fill("contoh-sandi-123");
        await page.getByText("Daftar", { exact: true }).click();
        const otp = page.getByLabel("Kode verifikasi", { exact: true });
        await otp.waitFor();
        await page.screenshot({ path: `${output}/account-email-register.png` });
        await otp.fill(code);
        await page.getByRole("button", { name: "Verifikasi kode", exact: true }).click();

        await page.getByRole("button", { name: "Lupa kata sandi?", exact: true }).click();
        await page.getByLabel("Email", { exact: true }).fill(example);
        await page.getByRole("button", { name: "Kirim kode", exact: true }).click();
        await otp.waitFor();
        await page.screenshot({ path: `${output}/account-email-reset-otp.png` });
        await otp.fill(code);
        await page.getByRole("button", { name: "Verifikasi kode", exact: true }).click();
        await page.getByLabel("Kata sandi baru", { exact: true }).waitFor();
        await page.screenshot({ path: `${output}/account-email-new-password.png` });
        await page.getByLabel("Kata sandi baru", { exact: true }).fill("sandi-baru-contoh");
        await page.getByLabel("Konfirmasi kata sandi baru", { exact: true }).fill("sandi-baru-contoh");
        await page.getByRole("button", { name: "Simpan kata sandi baru", exact: true }).click();
        await page.getByText("Kata sandi sudah diganti. Masuk dengan kata sandi baru.").waitFor();
        assert.deepEqual(calls.map(([path]) => path), Object.keys(routes));
        assert.equal(calls.at(-1)[1].reset_token, resetToken);
        assert.deepEqual(errors, []);
        console.log("PASS: captured registration OTP and password recovery with mock email.");
    } finally { await browser.close(); }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
