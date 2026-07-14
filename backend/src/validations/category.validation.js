const { z } = require("zod");

const createCategorySchema = z.object({
    name: z.string().trim().min(2).max(80),
});

const updateCategorySchema = z.object({
    name: z.string().trim().min(2).max(80),
});

const categoryIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

module.exports = {
    createCategorySchema,
    updateCategorySchema,
    categoryIdParamSchema,
};
