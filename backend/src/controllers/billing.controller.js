const { upsertBillingSettingsSchema, estimateBillSchema } = require("../validations/billing.validation");
const { getBillingSettings, upsertBillingSettings, estimateBill } = require("../services/billing.service");
const { ok, fail } = require("../utils/response");

async function getOwnedBillingSettings(req, res) {
  try {
    const data = await getBillingSettings(req.user.id);
    return ok(res, data, "Billing settings retrieved");
  } catch (err) {
    if (err.code === "42P01") {
      return fail(res, "Billing schema is not ready. Run latest DB migration.", 503, "BILLING_SCHEMA_NOT_READY");
    }
    console.error("getOwnedBillingSettings error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function upsertOwnedBillingSettings(req, res) {
  try {
    const parsed = upsertBillingSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
    }

    const data = await upsertBillingSettings(req.user.id, parsed.data);
    return ok(res, data, "Billing settings updated");
  } catch (err) {
    if (err.code === "42P01") {
      return fail(res, "Billing schema is not ready. Run latest DB migration.", 503, "BILLING_SCHEMA_NOT_READY");
    }
    console.error("upsertOwnedBillingSettings error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

async function estimateOwnedBill(req, res) {
  try {
    const parsed = estimateBillSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
    }

    const data = await estimateBill(req.user.id, parsed.data);
    return ok(res, data, "Bill estimate calculated");
  } catch (err) {
    if (err.code === "42P01") {
      return fail(res, "Billing schema is not ready. Run latest DB migration.", 503, "BILLING_SCHEMA_NOT_READY");
    }
    if (err.message === "CATEGORY_NOT_FOUND") {
      return fail(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
    }
    if (err.message === "CATEGORY_SCHEMA_NOT_READY") {
      return fail(res, "Category schema is not ready", 503, "CATEGORY_SCHEMA_NOT_READY");
    }
    if (err.message === "DEVICE_NOT_FOUND") {
      return fail(res, "One or more selected devices were not found", 404, "DEVICE_NOT_FOUND");
    }
    if (err.message === "BILLING_SETTINGS_NOT_FOUND") {
      return fail(res, "Billing settings not found. Set water price first.", 404, "BILLING_SETTINGS_NOT_FOUND");
    }
    console.error("estimateOwnedBill error:", err);
    return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
  }
}

module.exports = {
  getOwnedBillingSettings,
  upsertOwnedBillingSettings,
  estimateOwnedBill,
};
