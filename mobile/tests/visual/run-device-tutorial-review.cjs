// Local fixture session only; tutorial previews do not call BLE or write to the API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const createSession = require("./review-session.cjs");
const playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function designOf(locator, ancestorRadius) {
    return locator.evaluate((element, radius) => {
        if (radius) {
            while (element.parentElement && getComputedStyle(element).borderRadius !== `${radius}px`) element = element.parentElement;
        }
        const style = getComputedStyle(element);
        return Object.fromEntries(["width", "height", "backgroundColor", "borderColor", "borderWidth", "borderRadius",
            "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "gap", "flexDirection", "alignItems",
            "fontSize", "fontWeight", "lineHeight", "color"].map((key) => [key,
                key === "borderColor" && style.borderWidth === "0px" ? "unpainted" : style[key]]));
    }, ancestorRadius);
}

async function run() {
    const results = [];
    let output;
    for (const [width, height] of [[320, 640], [393, 852]]) {
        const session = await createSession(playwright, process.env.CHROME_EXECUTABLE, { tutorialSeen: false });
        const { page, errors } = session;
        output = session.output;
        await page.setViewportSize({ width, height });
        try {
            await page.goto("http://localhost:8081");
            await page.getByTestId("iot-tutorial").waitFor();
            for (const locale of ["id", "en"]) {
                if (locale === "en") {
                    await page.getByText("English", { exact: true }).click();
                    await page.getByRole("button", { name: "Connect IoT guide", exact: true }).click();
                }
                const guide = page.getByTestId("iot-tutorial");
                const labels = locale === "id"
                    ? { scan: "Hubungkan meter", manage: "Kelola", code: "Kode, mis. BV-ESP32-01", devices: "Perangkat" }
                    : { scan: "Connect a meter", manage: "Manage", code: "Code, e.g. BV-ESP32-01", devices: "Devices" };
                const reference = {};
                // Capture the settled full-screen modal, not a frame of its fade-in.
                await page.waitForTimeout(450);
                for (let step = 1; step <= 6; step += 1) {
                    await guide.getByText(`${step} / 6`, { exact: true }).waitFor();
                    const preview = guide.getByTestId("iot-tutorial-preview");
                    if (step === 1) {
                        reference.scanCard = await designOf(preview.getByText(labels.scan, { exact: true }), 14);
                        reference.scanTitle = await designOf(preview.getByText(labels.scan, { exact: true }));
                        reference.navbar = await designOf(preview.getByTestId("tab-icon-water"), 18);
                    }
                    if (step === 3) {
                        reference.codeInput = await designOf(preview.getByPlaceholder(labels.code, { exact: true }));
                        reference.manageTab = await designOf(preview.getByText(labels.manage, { exact: true }));
                    }
                    const button = guide.getByRole("button", { name: step === 6 ? (locale === "id" ? "Selesai" : "Done") : (locale === "id" ? "Lanjut" : "Next"), exact: true });
                    const box = await button.boundingBox();
                    assert.ok(box.y >= 0 && box.y + box.height <= height + 1, "Tutorial navigation must remain in the viewport");
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                    await page.screenshot({ path: `${output}/tutorial-${locale}-${width}-step-${step}.png` });
                    if (step === 5) {
                        await guide.getByText(locale === "id" ? "Kirim pengaturan" : "Send settings", { exact: true }).scrollIntoViewIfNeeded();
                        await page.screenshot({ path: `${output}/tutorial-${locale}-${width}-wifi-fields.png` });
                    }
                    await button.click();
                }
                await guide.waitFor({ state: "detached" });
                assert.equal(await page.evaluate(() => localStorage.getItem("wm_device_tutorial_seen_v1")), "true");
                await page.getByRole("tab", { name: labels.devices, exact: true }).click();
                await page.getByText(labels.scan, { exact: true }).waitFor();
                await page.waitForTimeout(500);
                assert.deepEqual(await designOf(page.getByText(labels.scan, { exact: true }), 14), reference.scanCard, "Guide uses the real scan card layout");
                assert.deepEqual(await designOf(page.getByText(labels.scan, { exact: true })), reference.scanTitle, "Guide uses the real title typography");
                assert.deepEqual(await designOf(page.getByTestId("tab-icon-water"), 18), reference.navbar, "Guide uses the real floating navbar");
                await page.getByText(labels.manage, { exact: true }).click();
                await page.getByPlaceholder(labels.code, { exact: true }).waitFor();
                await page.waitForTimeout(500);
                assert.deepEqual(await designOf(page.getByPlaceholder(labels.code, { exact: true })), reference.codeInput, "Guide uses the real input dimensions and styling");
                assert.deepEqual(await designOf(page.getByText(labels.manage, { exact: true })), reference.manageTab, "Guide uses the real selected tab styling");
                await page.screenshot({ path: `${output}/tutorial-real-form-${locale}-${width}.png` });
                await page.reload();
                await page.getByRole("tab", { name: locale === "id" ? "Profil" : "Profile", exact: true }).click();
                assert.equal(await page.getByTestId("iot-tutorial").count(), 0);
                const reopen = page.getByRole("button", { name: locale === "id" ? "Panduan menghubungkan IoT" : "Connect IoT guide", exact: true });
                const logout = page.getByText(locale === "id" ? "Keluar" : "Logout", { exact: true });
                assert.ok((await reopen.boundingBox()).y < (await logout.boundingBox()).y, "Guide belongs above logout");
                await page.screenshot({ path: `${output}/tutorial-profile-${locale}-${width}.png` });
                await reopen.click();
                await page.getByTestId("iot-tutorial").getByText("1 / 6", { exact: true }).waitFor();
                await page.getByRole("button", { name: locale === "id" ? "Lewati" : "Skip", exact: true }).click();
                results.push({ locale, width, height, steps: 6, persistence: true, reopen: true, footerVisible: true, realScreenDesignMatch: true });
                console.log(`PASS tutorial ${locale} ${width}x${height}`);
            }
            assert.deepEqual(errors, []);
        } finally {
            await session.browser.close();
        }
    }
    fs.writeFileSync(`${output}/device-tutorial-results.json`, JSON.stringify({ results }, null, 2));
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
