const { registerSchema, loginSchema } = require("../validations/auth.validation");
const { register, login } = require("../services/auth.service");
const { ok, fail } = require("../utils/response");

async function registerUser(req, res) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
    }

    const result = await register(parsed.data);
    return ok(res, result, "Register success", 201);
  } catch (err) {
    if (err.message === "EMAIL_ALREADY_USED") {
      return fail(res, "Email already used", 409, "EMAIL_ALREADY_USED");
    }
    console.error("registerUser error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function loginUser(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
    }

    const result = await login(parsed.data);
    return ok(res, result, "Login success");
  } catch (err) {
    if (err.message === "INVALID_CREDENTIALS") {
      return fail(res, "Invalid email or password", 401, "INVALID_CREDENTIALS");
    }
    console.error("loginUser error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function me(req, res) {
  return ok(res, req.user, "Current user");
}

module.exports = {
  registerUser,
  loginUser,
  me,
};
