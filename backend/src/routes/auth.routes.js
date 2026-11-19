const express = require("express");
const { z } = require("zod");
const { registerUser, loginUser, me } = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { rateLimit } = require("../middlewares/rate-limit.middleware");
const { registerSchema } = require("../validations/auth.validation");
const accountEmail = require("../services/account-email.service");
const { ok, fail } = require("../utils/response");

const router = express.Router();

// 10 auth attempts per minute per IP
const authLimiter = rateLimit({ windowMs: 60000, max: 10 });
const codeLimiter = rateLimit({ windowMs: 60000, max: 10 });
const email = z.string().trim().email().max(150);
const code = z.string().regex(/^\d{6}$/);

function emailHandler(schema, action, status = 200) {
    return async (req, res) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) return fail(res, "Invalid account email request", 422, "VALIDATION_ERROR");
        try { return ok(res, await action(parsed.data), "Request processed", status); }
        catch (err) {
            if (err.reportEmailError) return fail(res, err.message, err.status, err.code);
            if (err.message === "EMAIL_ALREADY_USED") return fail(res, "Email already used", 409, "EMAIL_ALREADY_USED");
            console.error("Account email request failed:", err.code || "INTERNAL_ERROR");
            return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
        }
    };
}

router.post("/register", authLimiter, registerUser);
router.post("/register/verify", codeLimiter, emailHandler(registerSchema.extend({ code }), accountEmail.confirmRegistration, 201));
router.post("/password-reset/request", codeLimiter,
    emailHandler(z.strictObject({ email, locale: z.enum(["en", "id"]).default("id") }), accountEmail.requestReset, 202));
router.post("/password-reset/verify", codeLimiter, emailHandler(z.strictObject({ email, code }), accountEmail.verifyReset));
router.post("/password-reset/complete", codeLimiter, emailHandler(z.strictObject({
    reset_token: z.string().regex(/^[a-f0-9]{64}$/), password: registerSchema.shape.password,
}), accountEmail.resetPassword));
router.post("/login", authLimiter, loginUser);
router.get("/me", requireAuth, me);

module.exports = router;
