// Only local intercepted fixture requests; the displayed tokens are synthetic.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const createSession = require("./review-session.cjs");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function run() {
    const results = [];
    let output;
    for (const width of [320, 393]) {
        for (const locale of ["id", "en"]) {
            for (const length of [48, 96]) {
                const token = "a1b2c3d4".repeat(length / 8);
                const session = await createSession(playwright, process.env.CHROME_EXECUTABLE, { deviceToken: token });
                const { page, errors } = session;
                output = session.output;
                try {
                    await page.setViewportSize({ width, height: 740 });
                    await page.goto("http://localhost:8081");
                    if (locale === "en") {
                        await page.getByRole("tab", { name: "Profil", exact: true }).click();
                        await page.getByText("English", { exact: true }).click();
                    }
                    const labels = locale === "id"
                        ? { devices: "Perangkat", manage: "Kelola", code: "Kode, mis. BV-ESP32-01", name: "Nama perangkat", add: "Tambah perangkat", copy: "Salin Token", ble: "Hubungkan via Bluetooth", close: "Tutup", show: "Lihat token" }
                        : { devices: "Devices", manage: "Manage", code: "Code, e.g. BV-ESP32-01", name: "Device name", add: "Add device", copy: "Copy Token", ble: "Connect via Bluetooth", close: "Close", show: "Show token" };
                    await page.getByRole("tab", { name: labels.devices, exact: true }).click();
                    await page.getByText(labels.manage, { exact: true }).click();
                    await page.getByPlaceholder(labels.code, { exact: true }).fill("VISUAL-METER");
                    await page.getByPlaceholder(labels.name, { exact: true }).fill("Visual meter");
                    await page.getByText(labels.add, { exact: true }).click();
                    const card = page.getByTestId("device-token-card");
                    await card.waitFor();
                    await page.waitForTimeout(450);
                    const copy = card.getByRole("button", { name: labels.copy, exact: true });
                    const ble = card.getByRole("button", { name: labels.ble, exact: true });
                    const close = card.getByRole("button", { name: labels.close, exact: true });
                    const [cardBox, copyBox, bleBox, closeBox] = await Promise.all([card.boundingBox(), copy.boundingBox(), ble.boundingBox(), close.boundingBox()]);
                    assert.ok(cardBox.y >= 0 && cardBox.y + cardBox.height <= 740, "Dialog stays within the screen");
                    assert.ok(Math.abs(copyBox.x - bleBox.x) < 1 && Math.abs(copyBox.width - bleBox.width) < 1, "Both actions align and fill the dialog");
                    assert.ok(copyBox.height >= 48 && bleBox.height >= 48 && closeBox.width >= 44 && closeBox.height >= 44, "Touch targets remain usable");
                    assert.ok(copyBox.y + copyBox.height < bleBox.y && closeBox.y < copyBox.y, "Copy and primary action do not wrap into an uneven row");
                    assert.equal(await card.evaluate((element) => element.scrollWidth > element.clientWidth), false, "Long tokens cannot widen the dialog");
                    assert.equal(await card.getByText(token, { exact: true }).evaluate((element) => element.scrollWidth > element.clientWidth), false, "Token wraps inside its box");
                    await page.screenshot({ path: `${output}/token-dialog-${locale}-${width}-${length}.png` });
                    await close.click();
                    await card.waitFor({ state: "detached" });
                    await page.getByText(labels.show, { exact: true }).click();
                    await card.waitFor();
                    assert.equal(await card.getByText(token, { exact: true }).count(), 1);
                    assert.deepEqual(errors, []);
                    results.push({ locale, width, tokenLength: length, aligned: true, contained: true, reopened: true });
                    console.log(`PASS token dialog ${locale} ${width}px ${length} characters`);
                } finally {
                    await session.browser.close();
                }
            }
        }
    }
    fs.writeFileSync(`${output}/token-dialog-results.json`, JSON.stringify({ results }, null, 2));
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
