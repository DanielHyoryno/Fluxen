const { createDeviceSchema, updateDeviceSchema, deviceIdParamSchema } = require("../validations/device.validation");
const {
    createDevice,
    listDevices,
    getDeviceById,
    updateDeviceById,
    deleteDeviceById,
} = require("../services/device.service");
const { ok, fail } = require("../utils/response");

async function createOwnedDevice(req, res) {
    try {
        const parsed = createDeviceSchema.safeParse(req.body);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
        }

        const data = await createDevice(req.user.id, parsed.data);
        return ok(res, data, "Device created", 201);
    } catch (err) {
        if (err.message === "CATEGORY_SCHEMA_NOT_READY") {
            return fail(
                res,
                "Category schema is not ready. Run latest DB migration.",
                503,
                "CATEGORY_SCHEMA_NOT_READY"
            );
        }
        if (err.message === "CATEGORY_NOT_FOUND") {
            return fail(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
        }
        if (err.code === "23505") {
            return fail(res, "device_code already used", 409, "DEVICE_CODE_ALREADY_USED");
        }
        console.error("createOwnedDevice error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function listOwnedDevices(req, res) {
    try {
        const items = await listDevices(req.user.id);
        return ok(res, { items }, "Devices retrieved");
    } catch (err) {
        console.error("listOwnedDevices error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function getOwnedDevice(req, res) {
    try {
        const parsed = deviceIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid params", 422, "VALIDATION_ERROR");
        }

        const item = await getDeviceById(req.user.id, parsed.data.id);
        return ok(res, item, "Device retrieved");
    } catch (err) {
        if (err.message === "CATEGORY_SCHEMA_NOT_READY") {
            return fail(
                res,
                "Category schema is not ready. Run latest DB migration.",
                503,
                "CATEGORY_SCHEMA_NOT_READY"
            );
        }
        if (err.message === "CATEGORY_NOT_FOUND") {
            return fail(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
        }
        if (err.message === "DEVICE_NOT_FOUND") {
            return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
        }
        console.error("getOwnedDevice error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function updateOwnedDevice(req, res) {
    try {
        const parsedParams = deviceIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return fail(res, parsedParams.error.issues[0]?.message || "Invalid params", 422, "VALIDATION_ERROR");
        }

        const parsedBody = updateDeviceSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return fail(res, parsedBody.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
        }

        const item = await updateDeviceById(req.user.id, parsedParams.data.id, parsedBody.data);
        return ok(res, item, "Device updated");
    } catch (err) {
        if (err.message === "CATEGORY_SCHEMA_NOT_READY") {
            return fail(
                res,
                "Category schema is not ready. Run latest DB migration.",
                503,
                "CATEGORY_SCHEMA_NOT_READY"
            );
        }
        if (err.message === "CATEGORY_NOT_FOUND") {
            return fail(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
        }
        if (err.message === "DEVICE_NOT_FOUND") {
            return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
        }
        console.error("updateOwnedDevice error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function deleteOwnedDevice(req, res) {
    try {
        const parsed = deviceIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid params", 422, "VALIDATION_ERROR");
        }

        const result = await deleteDeviceById(req.user.id, parsed.data.id);
        return ok(res, result, "Device deleted");
    } catch (err) {
        if (err.message === "DEVICE_NOT_FOUND") {
            return fail(res, "Device not found", 404, "DEVICE_NOT_FOUND");
        }
        console.error("deleteOwnedDevice error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

module.exports = {
    createOwnedDevice,
    listOwnedDevices,
    getOwnedDevice,
    updateOwnedDevice,
    deleteOwnedDevice,
};
