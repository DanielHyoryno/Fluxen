// Reproducible local-only entry point. Requires the disposable PostgreSQL test
// cluster on localhost and, for browser checks, the local Expo web preview.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "output/testing/2026-10-29");
const localUrl = process.env.TEST_DATABASE_URL || "postgresql://fluxen_test@127.0.0.1:55439/postgres";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(localUrl).hostname)) throw new Error("Only a localhost test database is permitted");
fs.mkdirSync(out, { recursive: true });
const env = { ...process.env, BLACKBOX_EVIDENCE_DIR: out, TEST_DATABASE_URL: localUrl,
    TEST_DATABASE_SCHEMA: `fluxen_runner_${process.pid}_test`, DB_SSL: "false",
    JWT_SECRET: "local-blackbox-only-not-production", EXPO_ACCESS_TOKEN: "", PUSH_NOTIFICATIONS_ENABLED: "false" };
const failedCommands = [];
function run(name, args, cwd = root) {
    console.log(`Running ${name}...`);
    const result = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true, timeout: 300000 });
    fs.writeFileSync(path.join(out, `${name}.log`), `${result.stdout || ""}\n${result.stderr || ""}`);
    if (result.status !== 0) { failedCommands.push(name); console.log(`FAILED ${name}: see ${name}.log`); }
    else console.log(`PASSED ${name}`);
}
if (!process.argv.includes("--report-only")) {
    run("mobile", [path.join(root, "mobile/node_modules/jest/bin/jest.js"), "--config", path.join(root,"mobile/jest.config.js"),
        "--runInBand", "--silent", "--cacheDirectory", path.join(out,"jest-cache"), "--json", "--outputFile", path.join(out,"mobile-final.json")]);
    run("backend", ["--test", "--test-reporter=tap", `--test-reporter-destination=${path.join(out,"backend.tap")}`], path.join(root,"backend"));
    run("api", [path.join(root,"backend/tools/blackbox-local.cjs")]);
    if (process.argv.includes("--visual")) {
        for (const [name, script] of [
            ["browser-layout","run-review.cjs"], ["browser-tutorial","run-device-tutorial-review.cjs"],
            ["browser-token","run-token-dialog-review.cjs"], ["browser-interaction","run-daily-usage-interaction-review.cjs"],
            ["browser-chart","run-home-chart-review.cjs"],
        ]) run(name, [path.join(root,"mobile/tests/visual",script)], path.join(root,"mobile"));
    } else env.BLACKBOX_SKIP_VISUAL = "1";
}
run("report", [path.join(root,"tools/blackbox-report.cjs")]);
console.log(`Report: ${path.join(out,"blackbox-ringkas-hasil.html")}`);
if (failedCommands.length) process.exitCode = 1;
