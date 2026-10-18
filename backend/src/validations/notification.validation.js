const { z } = require("zod");

const expoToken = z.string().max(256).regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{8,200}\]$/);
const registerPushSchema = z.object({ token: expoToken, locale: z.enum(["en", "id"]).default("en") }).strict();
const unregisterPushSchema = z.object({ token: expoToken }).strict();

module.exports = { registerPushSchema, unregisterPushSchema };
