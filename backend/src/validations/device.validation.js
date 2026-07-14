const { z } = require("zod");

const createDeviceSchema = z.object({
    device_code: z.string().min(3).max(50),
    device_name: z.string().min(2).max(100),
    category_id: z.coerce.number().int().positive().nullable().optional(),
    install_location: z.string().max(150).optional(),
    firmware_version: z.string().max(30).optional(),
});

const updateDeviceSchema = z
    .object({
        device_name: z.string().min(2).max(100).optional(),
        category_id: z.coerce.number().int().positive().nullable().optional(),
        install_location: z.string().max(150).nullable().optional(),
        firmware_version: z.string().max(30).nullable().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field must be provided",
    });

const deviceIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

module.exports = {
    createDeviceSchema,
    updateDeviceSchema,
    deviceIdParamSchema,
};
