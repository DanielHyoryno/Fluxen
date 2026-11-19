const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middlewares/auth.middleware");
const { rateLimit } = require("../middlewares/rate-limit.middleware");
const { ok, fail } = require("../utils/response");
const service = require("../services/report-email.service");

const router = express.Router();
const locale = z.enum(["id", "en"]).default("id");
const requestSchema = z.strictObject({ locale });
const verifySchema = z.strictObject({ code: z.string().regex(/^\d{6}$/) });
const reportSchema = z.strictObject({
    device_code: z.string().trim().min(3).max(50),
    from: z.iso.date(),
    to: z.iso.date(),
    locale,
}).refine(({ from, to }) => from <= to && Date.parse(to) - Date.parse(from) <= 365 * 86400000);

function handler(action, schema, successMessage, status = 200) {
    return async (req, res) => {
        const parsed = schema?.safeParse(req.body);
        if (parsed && !parsed.success) return fail(res, "Invalid report email request", 422, "VALIDATION_ERROR");
        try {
            return ok(res, await action(req.user, parsed?.data), successMessage, status);
        } catch (error) {
            if (error.reportEmailError) return fail(res, error.message, error.status, error.code);
            if (error.message === "DEVICE_NOT_FOUND") return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
            console.error("Report email request failed:", error.code || "INTERNAL_ERROR");
            return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
        }
    };
}

router.use(requireAuth);
router.get("/status", rateLimit({ max: 20 }), handler(service.getStatus, null, "Report email status"));
router.post("/verification", rateLimit({ max: 5, windowMs: 3600000 }),
    handler((user, body) => service.requestCode(user, body.locale), requestSchema, "Verification request accepted"));
router.post("/verification/confirm", rateLimit({ max: 20, windowMs: 3600000 }),
    handler((user, body) => service.verifyCode(user, body.code), verifySchema, "Email verified"));
router.post("/xlsx", rateLimit({ max: 5, windowMs: 3600000 }),
    handler(service.sendReport, reportSchema, "Report email accepted for delivery", 202));

module.exports = router;
