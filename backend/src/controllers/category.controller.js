const {
    createCategorySchema,
    updateCategorySchema,
    categoryIdParamSchema,
} = require("../validations/category.validation");
const { createCategory, listCategories, updateCategory, deleteCategory } = require("../services/category.service");
const { ok, fail } = require("../utils/response");

async function listOwnedCategories(req, res) {
    try {
        const items = await listCategories(req.user.id);
        return ok(res, { items }, "Categories retrieved");
    } catch (err) {
        if (err.code === "42P01") {
            return fail(
                res,
                "Category schema is not ready. Run latest DB migration.",
                503,
                "CATEGORY_SCHEMA_NOT_READY"
            );
        }
        console.error("listOwnedCategories error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function createOwnedCategory(req, res) {
    try {
        const parsed = createCategorySchema.safeParse(req.body);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
        }

        const data = await createCategory(req.user.id, parsed.data);
        return ok(res, data, "Category created", 201);
    } catch (err) {
        if (err.code === "42P01") {
            return fail(
                res,
                "Category schema is not ready. Run latest DB migration.",
                503,
                "CATEGORY_SCHEMA_NOT_READY"
            );
        }
        if (err.code === "23505") {
            return fail(res, "Category name already exists", 409, "CATEGORY_ALREADY_EXISTS");
        }
        console.error("createOwnedCategory error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function updateOwnedCategory(req, res) {
    try {
        const parsedParams = categoryIdParamSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return fail(res, parsedParams.error.issues[0]?.message || "Invalid params", 422, "VALIDATION_ERROR");
        }

        const parsedBody = updateCategorySchema.safeParse(req.body);
        if (!parsedBody.success) {
            return fail(res, parsedBody.error.issues[0]?.message || "Invalid payload", 422, "VALIDATION_ERROR");
        }

        const data = await updateCategory(req.user.id, parsedParams.data.id, parsedBody.data);
        return ok(res, data, "Category updated");
    } catch (err) {
        if (err.code === "42P01") {
            return fail(
                res,
                "Category schema is not ready. Run latest DB migration.",
                503,
                "CATEGORY_SCHEMA_NOT_READY"
            );
        }
        if (err.code === "23505") {
            return fail(res, "Category name already exists", 409, "CATEGORY_ALREADY_EXISTS");
        }
        if (err.message === "CATEGORY_NOT_FOUND") {
            return fail(res, "Category not found", 404, "CATEGORY_NOT_FOUND");
        }
        console.error("updateOwnedCategory error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

async function deleteOwnedCategory(req, res) {
    try {
        const parsed = categoryIdParamSchema.safeParse(req.params);
        if (!parsed.success) {
            return fail(res, parsed.error.issues[0]?.message || "Invalid params", 422, "VALIDATION_ERROR");
        }

        const result = await deleteCategory(req.user.id, parsed.data.id);
        return ok(res, result, "Category deleted");
    } catch (err) {
        if (err.code === "42P01") {
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
        console.error("deleteOwnedCategory error:", err);
        return fail(res, "Internal server error", 500, "INTERNAL_ERROR");
    }
}

module.exports = {
    listOwnedCategories,
    createOwnedCategory,
    updateOwnedCategory,
    deleteOwnedCategory,
};
