const env = require("../config/env");
const { ok, fail } = require("../utils/response");
const { registerPushSchema, unregisterPushSchema } = require("../validations/notification.validation");
const { registerPushSubscription, unregisterPushSubscription } = require("../services/push-subscription.service");

function handleFailure(res, error) {
    if (error.code === "42703" || error.code === "42P01") return fail(res, "Push configuration is not ready", 503, "PUSH_NOT_READY");
    // Do not log payloads, tokens, or database error details.
    console.warn("Push subscription request failed", error.code || "INTERNAL_ERROR");
    return fail(res, "Unable to update push subscription", 503, "PUSH_UNAVAILABLE");
}

async function register(req, res) {
    const parsed = registerPushSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid push registration", 422, "VALIDATION_ERROR");
    if (!env.push.enabled) return fail(res, "Push notifications are not enabled", 503, "PUSH_NOT_READY");
    try { return ok(res, await registerPushSubscription(req.user.id, parsed.data, req.auth.expiresAt)); }
    catch (error) { return handleFailure(res, error); }
}

async function unregister(req, res) {
    const parsed = unregisterPushSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid push registration", 422, "VALIDATION_ERROR");
    try { return ok(res, await unregisterPushSubscription(req.user.id, parsed.data.token)); }
    catch (error) { return handleFailure(res, error); }
}

module.exports = { register, unregister };
