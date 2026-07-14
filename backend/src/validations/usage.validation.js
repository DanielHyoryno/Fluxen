const { z } = require("zod");

const getUsageLimitSchema = z.object({
    device_code: z.string().min(3).max(50),
});

const upsertUsageLimitSchema = z.object({
    device_code: z.string().min(3).max(50),
    daily_usage_limit_l: z.number().positive().optional().nullable(),
    monthly_usage_limit_l: z.number().positive().optional().nullable(),
});

const listAlertsSchema = z.object({
    device_code: z.string().min(3).max(50),
    status: z.enum(["active", "resolved"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
});

const listAllAlertsSchema = z.object({
    status: z.enum(["active", "resolved"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
});

const dismissAlertSchema = z.object({
    alert_id: z.coerce.number().int().positive(),
});

module.exports = {
    getUsageLimitSchema,
    upsertUsageLimitSchema,
    listAlertsSchema,
    listAllAlertsSchema,
    dismissAlertSchema,
};
