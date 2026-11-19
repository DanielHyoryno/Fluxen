require("dotenv").config();

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function toSchemaName(value, fallback = "public") {
    const schema = String(value || fallback).trim();
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) {
        throw new Error("DB_SCHEMA must be a lowercase PostgreSQL identifier");
    }
    return schema;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

const config = {
    nodeEnv: NODE_ENV,
    isProd: IS_PROD,
    port: toNumber(process.env.PORT, 8080),
    databaseUrl: process.env.DATABASE_URL || "",
    dbSsl: toBoolean(process.env.DB_SSL, IS_PROD),
    dbSchema: toSchemaName(process.env.DB_SCHEMA),
    db: {
        host: process.env.DB_HOST || "localhost",
        port: toNumber(process.env.DB_PORT, 5432),
        user: process.env.DB_USER || "skripsi_user",
        password: process.env.DB_PASSWORD || "skripsi_pass",
        name: process.env.DB_NAME || "skripsi_db",
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || "",
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
    firebaseAuth: {
        enabled: toBoolean(process.env.FIREBASE_AUTH_ENABLED),
        projectId: (process.env.FIREBASE_AUTH_PROJECT_ID || "").trim(),
        apiKey: (process.env.FIREBASE_AUTH_API_KEY || "").trim(),
        serviceAccountFile: (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim(),
    },
    businessTimezone: process.env.BUSINESS_TIMEZONE || "Asia/Jakarta",
    push: {
        enabled: toBoolean(process.env.PUSH_NOTIFICATIONS_ENABLED, false),
        accessToken: process.env.EXPO_ACCESS_TOKEN || "",
    },
    reportEmail: {
        enabled: toBoolean(process.env.REPORT_EMAIL_ENABLED, false),
        accountEnabled: toBoolean(process.env.ACCOUNT_EMAIL_ENABLED, false),
        otpSecret: process.env.REPORT_EMAIL_OTP_SECRET || "",
        apiKey: process.env.RESEND_API_KEY || "",
        from: process.env.REPORT_EMAIL_FROM || "",
    },
};

if (config.isProd && !config.auth.jwtSecret) {
    throw new Error("JWT_SECRET is required in production environment");
}

module.exports = config;
