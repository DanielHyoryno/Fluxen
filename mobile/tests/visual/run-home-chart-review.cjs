// Uses only intercepted local fixtures; no production requests or database writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const createSession = require("./review-session.cjs");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function inspectChart(page, days, zeroUsage) {
    await page.waitForFunction((count) => document.querySelectorAll('[data-testid^="usage-bar-"]').length === count, days);
    await page.waitForFunction(() => {
        const chart = document.querySelector('[data-testid="usage-chart"]');
        for (let element = chart; element; element = element.parentElement) {
            const style = getComputedStyle(element);
            if (Number(style.opacity) < 0.99 || style.visibility === "hidden" || style.display === "none") return false;
        }
        return true;
    });
    const layout = await page.getByTestId("usage-chart").evaluate((chart) => {
        const rect = (element) => {
            const bounds = element.getBoundingClientRect();
            return { x: bounds.x, right: bounds.right, width: bounds.width, height: bounds.height };
        };
        const bars = [...chart.querySelectorAll('[data-testid^="usage-bar-"]')].map(rect);
        const tracks = [...chart.querySelectorAll('[data-testid^="usage-track-"]')].map(rect);
        const fills = [...chart.querySelectorAll('[data-testid^="usage-fill-"]')].map(rect);
        const scroll = chart.querySelector('[data-testid="usage-bars-scroll"]');
        return { chart: rect(chart), bars, tracks, fills, scroll: rect(scroll), scrollWidth: scroll.scrollWidth };
    });
    assert.equal(layout.bars.length, days);
    assert.ok(layout.bars.every((bar) => bar.width >= 29 && bar.height >= 140), "Every date needs a non-collapsed column");
    assert.ok(layout.tracks.every((track) => track.width >= 29 && Math.abs(track.height - 120) < 0.5), `Chart tracks must retain their height: ${JSON.stringify(layout.tracks)}`);
    assert.ok(layout.chart.height <= 170, "Chart must not leave an oversized blank area");
    assert.ok(layout.scrollWidth > layout.scroll.width, "Long ranges must be horizontally scrollable");
    if (zeroUsage) assert.ok(layout.fills.every((fill) => fill.height < 0.5));
    else assert.ok(layout.fills.some((fill) => fill.height > 0), "Usage must produce visible blue bars");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "The page itself must not overflow horizontally");

    await page.getByTestId("usage-bars-scroll").evaluate((scroll) => { scroll.scrollLeft = scroll.scrollWidth; });
    await page.waitForFunction(() => {
        const scroll = document.querySelector('[data-testid="usage-bars-scroll"]').getBoundingClientRect();
        const last = [...document.querySelectorAll('[data-testid^="usage-bar-"]')].at(-1).getBoundingClientRect();
        return last.right <= scroll.right + 1 && last.x >= scroll.x - 1;
    });
    return { days, zeroUsage, columns: layout.bars.length, chartHeight: layout.chart.height, lastDayReachable: true };
}

async function run() {
    const results = [];
    let output;
    for (const days of [10, 11, 30]) {
        for (const zeroUsage of [true, false]) {
            const session = await createSession(playwright, process.env.CHROME_EXECUTABLE);
            const { page, errors } = session;
            output = session.output;
            session.setZeroUsage(zeroUsage);
            await page.clock.install({ time: new Date(`2026-10-${String(days).padStart(2, "0")}T12:00:00+07:00`) });
            try {
                await page.goto("http://localhost:8081");
                for (const locale of ["id", "en"]) {
                    await page.getByRole("tab", { name: "Profil", exact: true }).click();
                    await page.getByText(locale === "id" ? "Bahasa Indonesia" : "English", { exact: true }).click();
                    await page.getByRole("tab", { name: locale === "id" ? "Beranda" : "Home", exact: true }).click();
                    for (const width of [320, 393]) {
                        await page.setViewportSize({ width, height: 852 });
                        await page.getByRole("button", { name: locale === "id" ? "Minggu" : "Week", exact: true }).click();
                        await page.waitForFunction(() => document.querySelectorAll('[data-testid^="usage-bar-"]').length === 7);
                        await page.getByRole("button", { name: locale === "id" ? "Bulan" : "Month", exact: true }).click();
                        const result = await inspectChart(page, days, zeroUsage);
                        await page.getByTestId("usage-chart").scrollIntoViewIfNeeded();
                        await page.screenshot({ path: `${output}/chart-${days}-days-${zeroUsage ? "zero" : "usage"}-${locale}-${width}.png` });

                        // The same range must survive switching into the custom-period mode.
                        await page.getByRole("button", { name: "Custom", exact: true }).click();
                        await inspectChart(page, days, zeroUsage);
                        results.push({ ...result, locale, width, monthAndCustom: true });
                    }
                }
                assert.deepEqual(errors, []);
            } finally {
                await session.browser.close();
            }
        }
    }
    fs.writeFileSync(`${output}/home-chart-results.json`, JSON.stringify({ results }, null, 2));
    console.log(`PASS: ${results.length} chart cases; Month and Custom; screenshots in ${output}`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
