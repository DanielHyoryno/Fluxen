const assert = require("node:assert/strict");
const fs = require("node:fs");
const createSession = require("./review-session.cjs");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function run() {
    const session = await createSession(playwright, process.env.CHROME_EXECUTABLE);
    const { page, output, errors } = session;
    const results = [];
    try {
        await page.goto("http://localhost:8081");
        await page.getByRole("tab", { name: "Profil", exact: true }).click();
        for (const locale of ["id", "en"]) {
            await page.getByText(locale === "id" ? "Bahasa Indonesia" : "English", { exact: true }).click();
            await page.getByRole("tab", { name: locale === "id" ? "Beranda" : "Home", exact: true }).click();
            for (const width of [320, 360, 393, 430]) {
                await page.setViewportSize({ width, height: 852 });
                await page.getByRole("button", { name: locale === "id" ? "Minggu" : "Week", exact: true }).click();
                await page.waitForTimeout(400);
                const values = await page.getByText("Total", { exact: true }).evaluate((element) => {
                    const row = element.parentElement.parentElement.parentElement;
                    return [...row.children].map((card) => {
                        const rect = card.lastElementChild.getBoundingClientRect();
                        return { x: rect.x, y: rect.y, height: rect.height };
                    });
                });
                if (width >= 360) assert.ok(Math.abs(values[0].y - values[1].y) <= 1, "Metric values must align");
                else assert.ok(values[1].y > values[0].y, "Narrow metric grid must stack");
                const nav = await page.getByRole("tab").first().evaluate((element) => {
                    const rect = element.closest('[role="tablist"]').getBoundingClientRect();
                    return { x: rect.x, right: rect.right, bottom: rect.bottom };
                });
                assert.equal(nav.x, 16);
                assert.equal(nav.right, width - 16);
                assert.equal(nav.bottom, 842);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                await page.screenshot({ path: `${output}/home-${locale}-${width}.png` });
                await page.getByRole("button", { name: "Custom", exact: true }).click();
                await page.waitForTimeout(250);
                await page.screenshot({ path: `${output}/custom-${locale}-${width}.png` });
                results.push({ locale, width, metricsAlignedOrStacked: true, navbarInset: 16, overflow: false });
            }
            await page.getByRole("tab", { name: locale === "id" ? "Profil" : "Profile", exact: true }).click();
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(`${output}/results.json`, JSON.stringify({ results, runtimeErrors: errors }, null, 2));
        console.log(`PASS: ${results.length} language/viewport combinations; screenshots in ${output}`);
    } finally {
        await session.browser.close();
    }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
