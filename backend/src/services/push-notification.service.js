const pool = require("../config/db");
const env = require("../config/env");
const { unregisterPushSubscription } = require("./push-subscription.service");

const EXPO_API = "https://exp.host/--/api/v2/push";
const pending = new Set();
let running = 0;
const receiptTimers = new Set();

function buildPushMessage(alert, subscription) {
    const id = subscription.locale === "id";
    const daily = alert.alert_type === "USAGE_LIMIT_DAILY";
    const number = value => Number(value || 0).toLocaleString(id ? "id-ID" : "en-US", { maximumFractionDigits: 2 });
    return {
        to: subscription.token,
        title: id ? (daily ? "Batas harian terlampaui" : "Batas bulanan terlampaui") : (daily ? "Daily limit exceeded" : "Monthly limit exceeded"),
        body: id
            ? `${alert.device_name}: ${number(alert.meta?.consumed_l)} L, batas ${number(alert.meta?.limit_l)} L.`
            : `${alert.device_name}: ${number(alert.meta?.consumed_l)} L used, limit ${number(alert.meta?.limit_l)} L.`,
        sound: "default", channelId: "usage-alerts", priority: "high", ttl: 3600,
        data: { alertId: String(alert.id), deviceCode: alert.device_code, alertType: alert.alert_type },
    };
}

async function expoRequest(endpoint, body) {
    const response = await fetch(`${EXPO_API}/${endpoint}`, {
        method: "POST", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", ...(env.push.accessToken ? { Authorization: `Bearer ${env.push.accessToken}` } : {}) },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const error = new Error("PUSH_HTTP_ERROR");
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
    }
    return response.json();
}

async function getRecipient(alertId) {
    const result = await pool.query(
        `SELECT a.id, a.alert_type, a.meta, d.device_name, d.device_code, u.id AS user_id, u.push_subscription
         FROM alerts a JOIN devices d ON d.id = a.device_id JOIN users u ON u.id = d.user_id
         WHERE a.id = $1 AND a.status = 'active' AND d.pending_command IS NULL
           AND a.alert_type IN ('USAGE_LIMIT_DAILY', 'USAGE_LIMIT_MONTHLY')`, [alertId]
    );
    const alert = result.rows[0];
    const subscription = alert?.push_subscription;
    if (!subscription?.token) return null;
    const expiry = Date.parse(subscription.expires_at);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;
    return alert;
}

function scheduleReceiptCheck(ticketId, userId, token) {
    if (receiptTimers.size >= 200) return;
    const timer = setTimeout(async () => {
        receiptTimers.delete(timer);
        try {
            const result = await expoRequest("getReceipts", { ids: [ticketId] });
            const receipt = result.data?.[ticketId];
            if (receipt?.details?.error === "DeviceNotRegistered") await unregisterPushSubscription(userId, token);
            else if (receipt?.status === "error") console.warn("Push receipt failed", receipt.details?.error || "PROVIDER_ERROR");
        } catch { console.warn("Push receipt check failed"); }
    }, 15 * 60 * 1000);
    timer.unref?.();
    receiptTimers.add(timer);
}

async function sendUsageAlertPush(alertId, { sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    if (!env.push.enabled) return;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            // Refresh ownership and status before every attempt, not only when queued.
            const alert = await getRecipient(alertId);
            if (!alert) return;
            const subscription = alert.push_subscription;
            const response = await expoRequest("send", buildPushMessage(alert, subscription));
            const ticket = Array.isArray(response.data) ? response.data[0] : response.data;
            if (ticket?.status === "ok" && ticket.id) {
                scheduleReceiptCheck(ticket.id, alert.user_id, subscription.token);
                return;
            }
            if (ticket?.details?.error === "DeviceNotRegistered") {
                await unregisterPushSubscription(alert.user_id, subscription.token);
                return;
            }
            const error = new Error("PUSH_TICKET_ERROR");
            error.retryable = ticket?.details?.error === "MessageRateExceeded";
            throw error;
        } catch (error) {
            if (attempt === 2 || error.retryable === false || error.message === "PUSH_TICKET_ERROR" && !error.retryable) {
                console.warn("Usage push failed", error.message === "PUSH_HTTP_ERROR" ? "PROVIDER_ERROR" : "SEND_FAILED");
                return;
            }
            await sleep(1000 * 2 ** attempt);
        }
    }
}

function drain() {
    while (running < 2 && pending.size) {
        const id = pending.values().next().value;
        pending.delete(id);
        running++;
        sendUsageAlertPush(id).catch(() => console.warn("Usage push failed"))
            .finally(() => { running--; drain(); });
    }
}

function queueUsageAlertPushes(alerts) {
    if (!env.push.enabled) return;
    for (const alert of alerts) {
        if (pending.size >= 200) { console.warn("Usage push queue full"); break; }
        if (alert.alert_id) pending.add(String(alert.alert_id));
    }
    setImmediate(drain);
}

module.exports = { queueUsageAlertPushes, sendUsageAlertPush, buildPushMessage };
