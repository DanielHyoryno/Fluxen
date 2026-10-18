const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

let queries = [];
let query;
const db = { query: (...args) => { queries.push(args); return query(...args); } };
db.connect = async () => ({ query: db.query, release() {} });
const env = { push: { enabled: true, accessToken: "" } };
require.cache[require.resolve("../src/config/db")] = { exports: db };
require.cache[require.resolve("../src/config/env")] = { exports: env };
const { sendUsageAlertPush, buildPushMessage } = require("../src/services/push-notification.service");
const { registerPushSubscription, unregisterPushSubscription } = require("../src/services/push-subscription.service");
const { registerPushSchema } = require("../src/validations/notification.validation");
const realFetch = global.fetch;
const token = "ExpoPushToken[phone_12345678]";
const recipient = () => ({ id: 1, user_id: 8, alert_type: "USAGE_LIMIT_DAILY", device_name: "Kitchen", device_code: "TEST-01",
    meta: { consumed_l: 12, limit_l: 10 }, push_subscription: { token, locale: "id", expires_at: new Date(Date.now() + 3600000).toISOString() } });

beforeEach(() => { queries = []; query = async () => ({ rows: [recipient()], rowCount: 1 }); env.push.enabled = true; });
afterEach(() => { global.fetch = realFetch; });

test("validates Expo tokens and supported locales", () => {
    assert.equal(registerPushSchema.safeParse({ token, locale: "id" }).success, true);
    assert.equal(registerPushSchema.safeParse({ token: "native-fcm-token", locale: "id" }).success, false);
    assert.equal(registerPushSchema.safeParse({ token, locale: "xx" }).success, false);
});
test("formats localized Android messages with navigation data and the correct channel", () => {
    const alert = recipient();
    const message = buildPushMessage(alert, alert.push_subscription);
    assert.equal(message.channelId, "usage-alerts");
    assert.equal(message.title, "Batas harian terlampaui");
    assert.equal(message.data.deviceCode, "TEST-01");
    assert.equal(message.priority, "high");
    assert.match(message.body, /12 L/);
});
test("sends one provider notification for an active subscribed recipient", async () => {
    const sent = [];
    global.fetch = async (url, options) => { sent.push([url, JSON.parse(options.body)]); return { ok: true, json: async () => ({ data: { status: "ok", id: "test-ticket" } }) }; };
    await sendUsageAlertPush(1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0][1].to, token);
});
test("does not send without a subscription, after expiry, or when disabled", async () => {
    let sent = 0;
    global.fetch = async () => { sent++; throw new Error("should not send"); };
    query = async () => ({ rows: [{ ...recipient(), push_subscription: null }] });
    await sendUsageAlertPush(1);
    query = async () => ({ rows: [{ ...recipient(), push_subscription: { token, expires_at: "2020-01-01" } }] });
    await sendUsageAlertPush(1);
    env.push.enabled = false;
    await sendUsageAlertPush(1);
    assert.equal(sent, 0);
});
test("retries temporary provider failures without throwing into telemetry", async () => {
    let calls = 0;
    global.fetch = async () => ++calls < 3 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ data: { status: "ok", id: "retried" } }) };
    await sendUsageAlertPush(1, { sleep: async () => {} });
    assert.equal(calls, 3);
});
test("stops when a queued alert is no longer active on retry", async () => {
    let reads = 0, calls = 0;
    query = async () => ({ rows: ++reads === 1 ? [recipient()] : [] });
    global.fetch = async () => { calls++; return { ok: false, status: 503 }; };
    await sendUsageAlertPush(1, { sleep: async () => {} });
    assert.equal(calls, 1);
});
test("invalid tokens are removed conditionally, not from other phones/accounts", async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ data: { status: "error", details: { error: "DeviceNotRegistered" } } }) });
    await sendUsageAlertPush(1);
    const update = queries.find(([sql]) => sql.startsWith("UPDATE users"));
    assert.match(update[0], /id = \$1 AND push_subscription/);
    assert.deepEqual(update[1], [8, token]);
});
test("registration is transactional and detaches the same phone from its previous owner", async () => {
    await registerPushSubscription(2, { token, locale: "en" }, Math.floor(Date.now() / 1000) + 3600);
    assert.equal(queries[0][0], "BEGIN");
    assert.match(queries[1][0], /pg_advisory_xact_lock/);
    assert.match(queries[2][0], /id <> \$1/);
    const saved = JSON.parse(queries[3][1][1]);
    assert.equal(saved.token, token);
    assert.equal(saved.locale, "en");
    assert.equal(queries.at(-1)[0], "COMMIT");
});
test("a failed registration rolls back instead of leaving account ownership half changed", async () => {
    query = async sql => { if (sql.includes("SET push_subscription = $2")) throw new Error("simulated"); return { rows: [] }; };
    await assert.rejects(registerPushSubscription(2, { token, locale: "en" }, Math.floor(Date.now() / 1000) + 3600));
    assert.equal(queries.at(-1)[0], "ROLLBACK");
});
test("logout only removes the matching token belonging to the authenticated user", async () => {
    await unregisterPushSubscription(2, token);
    assert.deepEqual(queries[0][1], [2, token]);
    assert.match(queries[0][0], /id = \$1 AND/);
});
