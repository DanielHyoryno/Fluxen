import { API_BASE_URL } from "../config/api";

const REQUEST_TIMEOUT_MS = 20000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please try again in a moment.");
    }

    throw new Error("Unable to reach server. Please check your connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function request(path, options = {}) {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || "Request failed");
  }

  return payload.data;
}

async function requestRaw(path, options = {}) {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Request failed");
  }

  return response.text();
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
