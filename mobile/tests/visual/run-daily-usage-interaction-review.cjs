// Intercepted fixtures only: no production requests, login, or database writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const createSession = require("./review-session.cjs");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function selectDay(page, date, dateLabel, volumeLabel) {
    const bar = page.getByTestId(`usage-bar-${date}`).last();
    await bar.click();
    const readout = page.getByTestId("usage-selection").last();
    await readout.getByText(dateLabel, { exact: true }).waitFor();
    assert.ok((await readout.innerText()).includes(volumeLabel));
    await readout.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
        const readouts = document.querySelectorAll('[data-testid="usage-selection"]');
        for (let element = readouts[readouts.length - 1]; element; element = element.parentElement) {
            const style = getComputedStyle(element);
            if (Number(style.opacity) < 0.99 || style.visibility === "hidden" || style.display === "none") return false;
        }
        return true;
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

async function run() {
    const results = [];
    let output;
    for (const locale of ["id", "en"]) {
        for (const width of [320, 393]) {
            for (const zeroUsage of [false, true]) {
                const session = await createSession(playwright, process.env.CHROME_EXECUTABLE);
                const { page, errors } = session;
                output = session.output;
                session.setZeroUsage(zeroUsage);
                await page.setViewportSize({ width, height: 852 });
                await page.clock.install({ time: new Date("2026-10-30T12:00:00+07:00") });
                const dateLabel = locale === "id" ? "27 Oktober 2026" : "October 27, 2026";
                const format = (value) => `${value.toLocaleString(locale === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} L`;
                try {
                    await page.goto("http://localhost:8081");
                    await page.getByRole("tab", { name: "Profil", exact: true }).click();
                    await page.getByText(locale === "id" ? "Bahasa Indonesia" : "English", { exact: true }).click();
                    await page.getByRole("tab", { name: locale === "id" ? "Beranda" : "Home", exact: true }).click();
                    await page.getByRole("button", { name: locale === "id" ? "Bulan" : "Month", exact: true }).click();
                    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="usage-bar-"]').length === 30);
                    await selectDay(page, "2026-10-27", dateLabel, format(zeroUsage ? 0 : 8.7));
                    await page.screenshot({ path: `${output}/tap-home-${locale}-${width}-${zeroUsage ? "zero" : "usage"}.png` });
                    await page.getByRole("button", { name: locale === "id" ? "Minggu" : "Week", exact: true }).click();
                    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="usage-bar-"]').length === 7);
                    await page.getByText(locale === "id" ? "Tekan batang untuk melihat pemakaian harian." : "Tap a bar to see daily usage.", { exact: true }).waitFor();
                    await page.getByText("Meter taman", { exact: true }).nth(1).click();
                    await page.getByText(locale === "id" ? "Riwayat pemakaian" : "Usage history", { exact: true }).first().click();
                    await page.getByRole("button", { name: locale === "id" ? "30 hari" : "30 days", exact: true }).click();
                    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="usage-chart"]')].at(-1).querySelectorAll('[data-testid^="usage-bar-"]').length === 30);
                    await selectDay(page, "2026-10-27", dateLabel, format(zeroUsage ? 0 : 4.35));
                    await page.screenshot({ path: `${output}/tap-history-${locale}-${width}-${zeroUsage ? "zero" : "usage"}.png` });
                    await page.getByRole("button", { name: locale === "id" ? "Rincian harian" : "Daily details", exact: true }).click();
                    await page.getByText(locale === "id" ? "Lihat 20 lagi" : "Show 20 more", { exact: true }).waitFor();
                    assert.deepEqual(errors, []);
                    results.push({ locale, width, zeroUsage, homeTotal: zeroUsage ? 0 : 8.7, deviceTotal: zeroUsage ? 0 : 4.35, rangeReset: true, dailyDetailsRetained: true });
                    console.log(`PASS ${locale} ${width}px ${zeroUsage ? "zero" : "usage"}`);
                } catch (error) {
                    await page.screenshot({ path: `${output}/tap-failure.png` });
                    console.log("Readouts:", await page.getByTestId("usage-selection").allTextContents());
                    throw error;
                } finally {
                    await session.browser.close();
                }
            }
        }
    }
    fs.writeFileSync(`${output}/daily-usage-interaction-results.json`, JSON.stringify({ results }, null, 2));
    console.log(`PASS: ${results.length} combinations across Home and Usage History`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
