const {
    getUsageLimitSchema,
    upsertUsageLimitSchema,
    listAlertsSchema,
    listAllAlertsSchema,
    dismissAlertSchema,
} = require("../validations/usage.validation");
const {
    getUsageLimits,
    upsertUsageLimits,
    listUsageAlerts,
    listAllUsageAlerts,
    dismissAlert,
} = require("../services/usage.service");
const { ok, fail } = require("../utils/response");

async function getDeviceUsageLimits(req, res) {
    try {
        const parsed = getUsageLimitSchema.safeParse(req.query);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid query", 422, "VALIDATION_ERROR");
        }

        const data = await getUsageLimits(req.user.id, parsed.data.device_code);
        return ok(res, data, "Usage limits retrieved");
    } catch (err) {
        if (err.message === "DEVICE_NOT_FOUND") {
            return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
        }
        console.error("getDeviceUsageLimits error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function upsertDeviceUsageLimits(req, res) {
    try {
        const parsed = upsertUsageLimitSchema.safeParse(req.body);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
        }

        const data = await upsertUsageLimits(req.user.id, parsed.data);
        return ok(res, data, "Usage limits updated");
    } catch (err) {
        if (err.message === "DEVICE_NOT_FOUND") {
            return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
        }
        console.error("upsertDeviceUsageLimits error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function getUsageAlerts(req, res) {
    try {
        const parsed = listAlertsSchema.safeParse(req.query);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid query", 422, "VALIDATION_ERROR");
        }

        const data = await listUsageAlerts(req.user.id, parsed.data);
        return ok(res, data, "Usage alerts retrieved");
    } catch (err) {
        if (err.message === "DEVICE_NOT_FOUND") {
            return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
        }
        console.error("getUsageAlerts error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function getAllUsageAlerts(req, res) {
    try {
        const parsed = listAllAlertsSchema.safeParse(req.query);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid query", 422, "VALIDATION_ERROR");
        }

        const data = await listAllUsageAlerts(req.user.id, parsed.data);
        return ok(res, data, "Usage alerts retrieved");
    } catch (err) {
        console.error("getAllUsageAlerts error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function dismissUsageAlert(req, res) {
    try {
        const parsed = dismissAlertSchema.safeParse(req.params);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid alert ID", 422, "VALIDATION_ERROR");
        }

        const data = await dismissAlert(req.user.id, parsed.data.alert_id);
        return ok(res, data, "Alert dismissed");
    } catch (err) {
        if (err.message === "ALERT_NOT_FOUND") {
            return fail(res, "Alert not found or not owned by you", 404, "ALERT_NOT_FOUND");
        }
        console.error("dismissUsageAlert error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

module.exports = {
    getDeviceUsageLimits,
    upsertDeviceUsageLimits,
    getUsageAlerts,
    getAllUsageAlerts,
    dismissUsageAlert,
};
