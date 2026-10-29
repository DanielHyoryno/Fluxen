// Real rendered Expo web UI. All API traffic is intercepted; no accounts are
// created on Render/Supabase. Screenshots are unmodified browser captures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "../../..");
const out = path.join(root, "output/testing/2026-10-29/ui-proof");
fs.mkdirSync(out, { recursive: true });
const results = [];
const findings = [];
async function run() {
    const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE });
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
        localStorage.removeItem("wm_access_token");
        localStorage.setItem("wm_app_locale", "id");
        localStorage.setItem("wm_device_tutorial_seen_v1", "true");
    });
    const registerRequests = [];
    let offlineLogin = false;
    await context.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin === "http://localhost:8081") return route.continue();
        if (url.origin !== "http://localhost:8099") return route.abort();
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" } });
        let status = 200, body;
        if (url.pathname.endsWith("/auth/register")) {
            const input = route.request().postDataJSON();
            registerRequests.push(input);
            if (input.email === "used@example.test") { status = 409; body = { success: false, message: "Email already used", error_code: "EMAIL_ALREADY_USED" }; }
            else body = { success: true, message: "Register success", data: { user: { id: 1, full_name: input.full_name, email: input.email } } };
        } else if (url.pathname.endsWith("/auth/login")) {
            if (offlineLogin) return route.abort();
            status = 401; body = { success: false, message: "Invalid email or password", error_code: "INVALID_CREDENTIALS" };
        } else { status = 404; body = { success: false, message: "No fixture for this endpoint" }; }
        return route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const runtimeErrors = [];
    page.on("pageerror", error => runtimeErrors.push(error.message));
    async function registration() {
        if (!await page.getByPlaceholder("Nama lengkap", { exact: true }).isVisible()) {
            await page.getByText("Belum punya akun? Daftar", { exact: true }).click();
            await page.getByPlaceholder("Nama lengkap", { exact: true }).waitFor();
        }
    }
    async function fill(input = {}) {
        const data = { name: "Pengguna Uji", email: "ui-proof@example.test", password: "password123", ...input };
        await page.getByPlaceholder("Nama lengkap", { exact: true }).fill(data.name);
        await page.locator('input[placeholder="Email"]:visible').fill(data.email);
        await page.getByPlaceholder("Kata sandi (8+ karakter)", { exact: true }).fill(data.password);
        return data;
    }
    async function capture(id, slug, action, observed, apiDelta, source) {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "No page overflow");
        await page.screenshot({ path: path.join(out, `${slug}.png`) });
        results.push({ id, action, observed, apiRequests: apiDelta, source, screenshot: `${slug}.png`, status: "passed" });
        console.log(`PASS ${id}: ${action}`);
    }
    try {
        await page.goto("http://localhost:8081");
        await registration();
        for (const [id, slug, action, input, expected] of [
            ["BB-REG-003", "name-empty", "Nama dikosongkan", { name: "" }, "Nama lengkap wajib diisi."],
            ["BB-REG-003", "name-short", "Nama satu karakter", { name: "A" }, "Gunakan minimal 2 karakter."],
            ["BB-REG-003", "name-long", "Nama 121 karakter", { name: "A".repeat(121) }, "Gunakan maksimal 120 karakter."],
            ["BB-REG-005", "email-empty", "Email dikosongkan", { email: "" }, "Email wajib diisi."],
            ["BB-REG-005", "email-invalid", "Format email salah", { email: "bukan-email" }, "Masukkan email yang valid."],
            ["BB-REG-005", "email-long", "Email 151 karakter", { email: `${"a".repeat(139)}@example.com` }, "Email maksimal 150 karakter."],
            ["BB-REG-006", "password-empty", "Kata sandi dikosongkan", { password: "" }, "Isi kata sandi."],
            ["BB-REG-006", "password-short", "Kata sandi tujuh karakter", { password: "1234567" }, "Gunakan minimal 8 karakter."],
            ["BB-REG-006", "password-long", "Kata sandi 101 karakter", { password: "a".repeat(101) }, "Gunakan maksimal 100 karakter."],
        ]) {
            await fill(input);
            const before = registerRequests.length;
            await page.getByText("Daftar", { exact: true }).click();
            const message = page.getByText(expected, { exact: true }); await message.waitFor();
            assert.equal(registerRequests.length, before, "Invalid input must not call the API");
            await capture(id, slug, action, await message.innerText(), 0, "Validasi frontend asli; tidak ada request registrasi");
        }
        for (const [id, slug, action, input] of [
            ["BB-REG-004", "name-min-valid", "Nama tepat dua karakter", { name: "AB" }],
            ["BB-REG-004", "name-max-valid", "Nama tepat 120 karakter", { name: "A".repeat(120) }],
            ["BB-REG-007", "password-min-valid", "Kata sandi tepat delapan karakter", { password: "12345678" }],
            ["BB-REG-007", "password-max-valid", "Kata sandi tepat 100 karakter", { password: "a".repeat(100) }],
            ["BB-REG-001", "register-trimmed", "Nama/email dengan spasi di tepi", { name: "  Pengguna Uji  ", email: "  ui-proof@example.test  " }],
        ]) {
            await registration(); const inputData = await fill(input); const before = registerRequests.length;
            await page.getByText("Daftar", { exact: true }).click();
            const message = page.getByText("Akun berhasil dibuat. Silakan masuk.", { exact: true }); await message.waitFor();
            assert.equal(registerRequests.length, before + 1);
            assert.equal(registerRequests.at(-1).full_name, inputData.name.trim());
            assert.equal(registerRequests.at(-1).email, inputData.email.trim());
            await capture(id, slug, action, await message.innerText(), 1, "Frontend asli; respons berhasil API dummy, bukan pembuatan akun produksi");
        }
        await registration(); await fill({ email: "used@example.test" });
        await page.getByText("Daftar", { exact: true }).click();
        const duplicate = page.getByText("Email ini sudah terdaftar.", { exact: true }); await duplicate.waitFor();
        await capture("BB-REG-002", "email-duplicate", "Email yang ditandai duplikat oleh API dummy", await duplicate.innerText(), 1, "Frontend asli menerima respons dummy HTTP 409");
        await page.getByText("Kembali masuk", { exact: true }).click();
        await page.locator('input[placeholder="Email"]:visible').fill("wrong@example.test");
        await page.locator('input[placeholder="Kata sandi"]:visible').fill("password123");
        await page.getByText("Masuk", { exact: true }).click();
        // Use the application's actual localized response, not an invented label.
        await page.waitForFunction(() => document.body.innerText.includes("sandi") && document.body.innerText.includes("salah"));
        const loginError = await page.locator("body").innerText();
        const actual = loginError.split("\n").find(line => /email|kata sandi/i.test(line) && /salah/i.test(line));
        assert.ok(actual, "Localized invalid-credentials message must be visible");
        await capture("BB-AUT-002", "login-invalid", "Login ditolak oleh API dummy", actual, 1, "Frontend asli menerima respons dummy HTTP 401");
        offlineLogin = true;
        await page.getByText("Masuk", { exact: true }).click();
        const unreachable = page.getByText("Server tidak terjangkau. Periksa koneksi.", { exact: true }); await unreachable.waitFor();
        await capture("BB-AUT-004", "login-network-error", "Permintaan login diputus pada transport simulasi", await unreachable.innerText(), 1, "Route browser dibatalkan; frontend asli menampilkan pesan koneksi");
        if (await page.getByText("Akun berhasil dibuat. Silakan masuk.", { exact: true }).isVisible()) {
            findings.push({ id: "UX-AUTH-001", severity: "minor", observed: "Konfirmasi registrasi sebelumnya masih tampil bersamaan dengan kegagalan login berikutnya.", screenshot: "login-network-error.png" });
        }
        assert.deepEqual(runtimeErrors, []);
    } catch (error) {
        await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
        fs.writeFileSync(path.join(out, "failure.txt"), String(error.stack));
        throw error;
    } finally {
        fs.writeFileSync(path.join(out, "ui-proof-results.json"), JSON.stringify({ environment: "Expo web localhost; intercepted dummy API; no Android/ESP32/production writes", results, runtimeErrors, findings }, null, 2));
        await browser.close();
    }
    const extra = [
        ["BB-HOM-003", "tap-home-id-393-usage.png", "Tekan 27 Oktober: Home menampilkan 8,700 L pada fixture dua meter."],
        ["BB-HIS-007", "tap-history-id-393-usage.png", "Tekan 27 Oktober: History perangkat menampilkan 4,350 L."],
        ["BB-DEV-014", "token-dialog-id-393-96.png", "Dialog token dummy panjang tetap berada di layar."],
        ["BB-TUT-002", "tutorial-id-393-step-5.png", "Langkah kelima tutorial menggunakan komponen formulir aplikasi."],
    ];
    for (const [id, name, observed] of extra) {
        const source = path.join(root, "mobile/coverage/ui-review", name);
        if (fs.existsSync(source)) {
            fs.copyFileSync(source, path.join(out, name));
            results.push({ id, action: "Bukti UI dari tes browser sebelumnya pada 29 Oktober", observed, screenshot: name, source: "Expo web + fixture dummy; lihat laporan browser sebelumnya", status: "passed" });
        }
    }
    const esc = value => String(value).replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
    const html = `<!doctype html><html lang="id"><meta charset="utf-8"><title>Fluxen - bukti UI</title><style>body{font:16px system-ui,sans-serif;background:#f4f8ff;color:#173448;max-width:1200px;margin:24px auto;padding:16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}figure{margin:0;padding:16px;background:white;border:1px solid #dbe6f5;border-radius:12px}img{display:block;max-width:100%;height:auto;margin:auto}figcaption{line-height:1.5;margin-top:12px}small{color:#51697b}h1{margin-bottom:8px}</style><h1>Fluxen: bukti pengujian melalui UI</h1><p>Screenshot asli dari Expo web. API memakai fixture dummy; tidak membuktikan database produksi, BLE fisik, atau penerimaan push Android.</p><p>${results.length - extra.length} aksi baru diuji melalui UI, ditambah bukti grafik/token/tutorial dari sesi browser sebelumnya. Hasil assertion dan request tersedia pada ui-proof-results.json.</p><div class="grid">${results.map(row => `<figure><a href="${esc(row.screenshot)}"><img src="${esc(row.screenshot)}" alt="${esc(row.action)}"></a><figcaption><strong>${esc(row.id)} — ${esc(row.action)}</strong><br>${esc(row.observed)}<br><small>${esc(row.source)}</small></figcaption></figure>`).join("")}</div></html>`;
    fs.writeFileSync(path.join(out, "index.html"), html.replace('<div class="grid">', `${findings.map(finding => `<p><strong>Catatan UI ${esc(finding.id)}:</strong> ${esc(finding.observed)}</p>`).join("")}<div class="grid">`));
    fs.writeFileSync(path.join(out, "ui-proof-results.json"), JSON.stringify({ environment: "Expo web + dummy API; no Android/ESP32/production writes", results, runtimeErrors: [], findings }, null, 2));
    console.log(`UI proof ready: ${results.length} screenshots; ${path.join(out, "index.html")}`);
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
