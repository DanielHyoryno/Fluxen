const { z } = require("zod");

const registerSchema = z.object({
    full_name: z.string().min(2).max(120),
    email: z.string().email().max(150),
    password: z.string().min(8).max(100),
});

const loginSchema = z.object({
    email: z.string().email().max(150),
    password: z.string().min(1),
});

module.exports = {
    registerSchema,
    loginSchema,
};
