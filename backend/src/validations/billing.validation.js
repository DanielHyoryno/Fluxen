const { z } = require("zod");

function isValidIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isoDateSchema = z.string().refine(isValidIsoDate, {
    message: "Date must use a valid YYYY-MM-DD format",
});

const upsertBillingSettingsSchema = z.object({
    price_per_liter: z.coerce.number().positive(),
    currency: z.string().trim().min(1).max(10).toUpperCase().optional().default("IDR"),
});

const estimateBillSchema = z
    .object({
        from: isoDateSchema,
        to: isoDateSchema,
        category_id: z.coerce.number().int().positive().nullable().optional(),
        device_ids: z.array(z.coerce.number().int().positive()).optional(),
    })
    .refine((value) => new Date(value.from) <= new Date(value.to), {
        message: "from must be earlier than or equal to to",
        path: ["from"],
    });

module.exports = {
    upsertBillingSettingsSchema,
    estimateBillSchema,
};
