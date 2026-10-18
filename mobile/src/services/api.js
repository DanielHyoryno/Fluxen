import { API_BASE_URL } from "../config/api";
import { getMessages } from "../constants/messages";
import { getAppLocale } from "./storage";
import { t } from "./i18n";

async function getActiveMessages() {
    const locale = await getAppLocale();
    return getMessages(locale || "en");
}

const REQUEST_TIMEOUT_MS = 20000;
const EXPORT_REQUEST_TIMEOUT_MS = 60000;

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS, read = (response) => response) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return await read(response);
    } catch (err) {
        if (err.appError) throw err;
        const messages = await getActiveMessages();

        if (err.name === "AbortError") {
            throw Object.assign(new Error(messages.auth.requestTimedOut), { code: "TIMEOUT" });
        }

        throw Object.assign(new Error(messages.auth.unableToReachServer), { code: "NETWORK_ERROR" });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function responseError(response, payload = {}) {
    const locale = (await getAppLocale()) || "en";
    const messages = getMessages(locale);
    const code = payload.error_code;
    const known = {
        EMAIL_ALREADY_USED: messages.auth.emailAlreadyUsed,
        DEVICE_CODE_ALREADY_USED: messages.devices.duplicateDeviceCodeError,
        CATEGORY_ALREADY_EXISTS: messages.categories.duplicateName,
        INVALID_CREDENTIALS: t("invalidCredentials", {}, locale),
        BILLING_SETTINGS_NOT_FOUND: t("priceNotSet", {}, locale),
        VALIDATION_ERROR: t("invalidInput", {}, locale),
    };
    let message = known[code];
    if (!message && payload.message === "Invalid email or password") message = t("invalidCredentials", {}, locale);
    if (!message) {
        const key = response.status >= 500 ? "serverError" : response.status === 401 ? "sessionError"
            : response.status === 403 ? "forbiddenError" : response.status === 404 ? "notFoundError"
              : response.status === 429 ? "rateLimitError" : "requestError";
        message = t(key, {}, locale);
    }
    return Object.assign(new Error(message), { code: code || "HTTP_ERROR", status: response.status, appError: true });
}

async function readJson(response) {
    try { return await response.json(); }
    catch (err) {
        if (err.name === "AbortError") throw err;
        if (!response.ok) return {};
        const locale = (await getAppLocale()) || "en";
        throw Object.assign(new Error(t("invalidResponse", {}, locale)), { code: "INVALID_RESPONSE", appError: true });
    }
}

async function request(path, options = {}) {
    return fetchWithTimeout(`${API_BASE_URL}${path}`, options, REQUEST_TIMEOUT_MS, async (response) => {
        const payload = await readJson(response);
        if (!response.ok || payload?.success === false) throw await responseError(response, payload || {});
        if (payload?.success !== true || !Object.prototype.hasOwnProperty.call(payload, "data")) {
            throw Object.assign(new Error(t("invalidResponse")), { code: "INVALID_RESPONSE", appError: true });
        }
        return payload.data;
    });
}

async function requestRaw(path, options = {}) {
    return fetchWithTimeout(`${API_BASE_URL}${path}`, options, REQUEST_TIMEOUT_MS, async (response) => {
        if (!response.ok) throw await responseError(response, await readJson(response));
        return response.text();
    });
}

async function requestBinaryRaw(path, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    return fetchWithTimeout(`${API_BASE_URL}${path}`, options, timeoutMs, async (response) => {
        if (!response.ok) throw await responseError(response, await readJson(response));
        return {
            arrayBuffer: await response.arrayBuffer(),
            contentType: response.headers.get("content-type") || "application/octet-stream",
            contentDisposition: response.headers.get("content-disposition") || "",
        };
    });
}

export async function registerApi(body) {
    return request("/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

export async function loginApi(body) {
    return request("/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

export async function meApi(token) {
    return request("/auth/me", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function registerPushTokenApi(token, pushToken, locale) {
    return request("/notifications/push-token", {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token: pushToken, locale }),
    });
}

export async function unregisterPushTokenApi(token, pushToken) {
    return request("/notifications/push-token", {
        method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token: pushToken }),
    });
}

export async function listDevicesApi(token) {
    return request("/devices", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function listCategoriesApi(token) {
    return request("/categories", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function createCategoryApi(token, body) {
    return request("/categories", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
}

export async function updateCategoryApi(token, categoryId, body) {
    return request(`/categories/${categoryId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
}

export async function deleteCategoryApi(token, categoryId) {
    return request(`/categories/${categoryId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function createDeviceApi(token, body) {
    return request("/devices", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
}

export async function deleteDeviceApi(token, deviceId) {
    return request(`/devices/${deviceId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function latestTelemetryApi(token, deviceCode) {
    const params = new URLSearchParams({ device_code: deviceCode });
    return request(`/telemetry/latest?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function dailyTelemetryApi(token, deviceCode, date) {
    const params = new URLSearchParams({ device_code: deviceCode, date });
    return request(`/telemetry/daily?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function usageHistoryApi(token, deviceCode, from, to) {
    const params = new URLSearchParams({ device_code: deviceCode, from, to });
    return request(`/telemetry/history?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function usageLimitsApi(token, deviceCode) {
    const params = new URLSearchParams({ device_code: deviceCode });
    return request(`/usage/limits?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function upsertUsageLimitsApi(token, body) {
    return request("/usage/limits", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
}

export async function usageAlertsApi(token, deviceCode, status = "active", limit = 20) {
    const params = new URLSearchParams({
        device_code: deviceCode,
        status,
        limit: String(limit),
    });

    return request(`/usage/alerts?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function usageAlertsAllApi(token, status = "active", limit = 20) {
    const params = new URLSearchParams({
        status,
        limit: String(limit),
    });

    return request(`/usage/alerts-all?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function dismissAlertApi(token, alertId) {
    return request(`/usage/alerts/${alertId}/dismiss`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function updateDeviceApi(token, deviceId, body) {
    return request(`/devices/${deviceId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
}

export async function exportCsvApi(token, deviceCode, from, to) {
    const params = new URLSearchParams({ device_code: deviceCode, from, to });
    return requestRaw(`/telemetry/export?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function exportXlsxApi(token, deviceCode, from, to) {
    const params = new URLSearchParams({ device_code: deviceCode, from, to });
    return requestBinaryRaw(
        `/telemetry/export-xlsx?${params.toString()}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
        EXPORT_REQUEST_TIMEOUT_MS
    );
}

export async function billingSettingsApi(token) {
    return request("/billing/settings", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function upsertBillingSettingsApi(token, body) {
    return request("/billing/settings", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
}

export async function estimateBillApi(token, body) {
    return request("/billing/estimate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
}
