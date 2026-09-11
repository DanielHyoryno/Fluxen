// Local-only visual fixtures. Run Expo with EXPO_PUBLIC_API_BASE_URL_WEB=http://localhost:8099/api/v1.
// The browser intercepts every fixture request; no real account or database is used.
const path = require("node:path");
const fs = require("node:fs");

module.exports = async function createReviewSession(playwright, executablePath) {
    const browser = await playwright.chromium.launch({ headless: true, executablePath });
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
        localStorage.setItem("wm_access_token", "visual-test-token");
        if (!localStorage.getItem("wm_app_locale")) localStorage.setItem("wm_app_locale", "id");
    });
    const devices = [
        { id: 1, device_code: "METER-01", device_name: "Meter air dapur dan ruang cuci lantai bawah", category_id: 1, category_name: "Rumah utama dan area belakang", status: "online" },
        { id: 2, device_code: "METER-02", device_name: "Meter taman", category_id: 2, category_name: "Taman", status: "offline" },
    ];
    let zeroUsage = false;
    await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === "http://localhost:8081") return route.continue();
        if (url.origin !== "http://localhost:8099") return route.abort();
        const endpoint = url.pathname;
        let data = { items: [] };
        if (endpoint.endsWith("/auth/me")) data = { id: 1, full_name: "Pengujian desain Fluxen", email: "visual@example.test" };
        else if (endpoint.endsWith("/devices")) data = { items: devices };
        else if (endpoint.endsWith("/categories")) data = { items: [{ id: 1, name: devices[0].category_name }, { id: 2, name: "Taman" }] };
        else if (endpoint.endsWith("/telemetry/latest")) data = { measured_at: url.searchParams.get("device_code") === "METER-02" ? "2026-09-01T00:00:00Z" : new Date().toISOString(), flow_rate_lpm: zeroUsage ? 0 : 2.1, volume_delta_l: zeroUsage ? 0 : 0.3 };
        else if (endpoint.endsWith("/telemetry/history")) {
            const start = new Date(`${url.searchParams.get("from")}T00:00:00Z`);
            const end = new Date(`${url.searchParams.get("to")}T00:00:00Z`);
            const items = [];
            for (let day = new Date(start); day <= end && items.length < 366; day.setUTCDate(day.getUTCDate() + 1)) {
                items.push({ date: day.toISOString().slice(0, 10), total_liters: zeroUsage ? 0 : 2.35 + items.length % 4 });
            }
            data = { items };
        } else if (endpoint.endsWith("/telemetry/daily")) data = { items: [{ measured_at: new Date().toISOString(), flow_rate_lpm: zeroUsage ? 0 : 2.1, volume_delta_l: zeroUsage ? 0 : 3.25 }] };
        else if (endpoint.endsWith("/billing/settings")) data = { price_per_liter: 15, currency: "IDR" };
        else if (endpoint.endsWith("/billing/estimate")) data = { summary: { total_liters: 125.3, estimated_cost: 1879.5, device_count: 2 }, items: devices.map((device) => ({ ...device, total_liters: 62.65, estimated_cost: 939.75 })) };
        else if (endpoint.endsWith("/usage/limits")) data = { daily_usage_limit_l: 200, monthly_usage_limit_l: 3000 };
        await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, body: JSON.stringify({ success: true, data }) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const output = path.resolve(__dirname, "../../coverage/ui-review");
    fs.mkdirSync(output, { recursive: true });
    return { browser, context, page, errors, output, setZeroUsage: (value) => { zeroUsage = value; } };
};
