const { registerSchema, loginSchema } = require("../validations/auth.validation");
const { register, login } = require("../services/auth.service");
const { ok, fail } = require("../utils/response");
const messages = require("../constants/messages");

async function registerUser(req, res) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.issues[0]?.message || messages.auth.invalidPayload, 422, "VALIDATION_ERROR");
    }

    const result = await register(parsed.data);
    return ok(res, result, messages.auth.registerSuccess, 201);
  } catch (err) {
    if (err.message === "EMAIL_ALREADY_USED") {
      return fail(res, messages.auth.emailAlreadyUsed, 409, "EMAIL_ALREADY_USED");
    }
    console.error("registerUser error:", err);
    return fail(res, messages.auth.internalServerError, 500, "INTERNAL_ERROR");
  }
}

async function loginUser(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.issues[0]?.message || messages.auth.invalidPayload, 422, "VALIDATION_ERROR");
    }

    const result = await login(parsed.data);
    return ok(res, result, messages.auth.loginSuccess);
  } catch (err) {
    if (err.message === "INVALID_CREDENTIALS") {
      return fail(res, messages.auth.invalidCredentials, 401, "INVALID_CREDENTIALS");
    }
    console.error("loginUser error:", err);
    return fail(res, messages.auth.internalServerError, 500, "INTERNAL_ERROR");
  }
}

async function me(req, res) {
  return ok(res, req.user, messages.auth.currentUser);
}

module.exports = {
  registerUser,
  loginUser,
  me,
};
