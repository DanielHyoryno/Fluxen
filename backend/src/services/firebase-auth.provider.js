const { readFileSync } = require("node:fs");
const { JWT } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const config = require("../config/env");

function authError(status, code, message) {
    return Object.assign(new Error(message), { status, code, reportEmailError: true });
}

const unavailable = () => authError(503, "ACCOUNT_EMAIL_UNAVAILABLE", "Firebase Auth is not available");
const invalidCredentials = () => authError(401, "INVALID_CREDENTIALS", "Invalid email or password");

const upstreamReasons = new Set([
    "API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED",
    "API_KEY_IP_ADDRESS_BLOCKED", "API_KEY_ANDROID_APP_BLOCKED", "API_KEY_IOS_APP_BLOCKED",
    "CONSUMER_INVALID", "SERVICE_DISABLED", "CONFIGURATION_NOT_FOUND", "PROJECT_NOT_FOUND",
    "OPERATION_NOT_ALLOWED", "ADMIN_ONLY_OPERATION", "MISSING_RECAPTCHA_TOKEN",
    "INVALID_RECAPTCHA_TOKEN", "INVALID_CONTINUE_URI", "UNAUTHORIZED_DOMAIN",
    "INVALID_SENDER", "INVALID_EMAIL_TEMPLATE", "QUOTA_EXCEEDED",
]);

class CredentialFailure extends Error {
    constructor(reason) {
        super("Firebase credential configuration invalid");
        this.reason = reason;
    }
}

function safeUpstreamReason(error, code) {
    for (const detail of Array.isArray(error?.details) ? error.details : []) {
        if (upstreamReasons.has(detail?.reason)) return detail.reason;
    }
    return upstreamReasons.has(code) ? code : "GOOGLE_REQUEST_REJECTED";
}

function createFirebaseProvider({
    settings, fetchImpl = (...args) => fetch(...args), now = Date.now, loadAdmin,
    warn = event => console.warn("[firebase-auth]", JSON.stringify(event)),
}) {
    const users = new Map();
    const lastWarnings = new Map();
    let admin;

    function failUnavailable(stage, reason, metadata = {}) {
        const key = `${stage}:${reason}:${metadata.operation || ""}:${(metadata.missing || []).join(",")}`;
        const time = now();
        if (!lastWarnings.has(key) || time - lastWarnings.get(key) >= 30000) {
            lastWarnings.set(key, time);
            // Caller supplies only constant stages/reasons/operations and numeric HTTP status.
            warn({ stage, reason, ...metadata });
        }
        return unavailable();
    }

    function requireAdmin() {
        if (!admin) {
            const missing = [];
            if (!settings.projectId) missing.push("FIREBASE_AUTH_PROJECT_ID");
            if (!settings.apiKey) missing.push("FIREBASE_AUTH_API_KEY");
            if (!settings.serviceAccountFile) missing.push("GOOGLE_APPLICATION_CREDENTIALS");
            if (missing.length) throw failUnavailable("configuration", "ENVIRONMENT_MISSING", { missing });
            try { admin = loadAdmin(settings); }
            catch (error) {
                throw failUnavailable("credentials", error instanceof CredentialFailure ? error.reason : "CREDENTIAL_INIT_FAILED");
            }
        }
        return admin;
    }

    async function request(action, body, locale) {
        requireAdmin();
        const url = new URL(`https://identitytoolkit.googleapis.com/v1/accounts:${action}`);
        url.searchParams.set("key", settings.apiKey);
        let response, data;
        try {
            response = await fetchImpl(url, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(locale ? { "X-Firebase-Locale": locale } : {}) },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(7000),
                redirect: "error",
            });
        } catch (error) {
            const reason = error?.name === "TimeoutError" || error?.name === "AbortError" ? "GOOGLE_TIMEOUT" : "GOOGLE_CONNECTION_FAILED";
            throw failUnavailable("identity_toolkit", reason, { operation: action });
        }
        try { data = await response.json(); }
        catch { throw failUnavailable("identity_toolkit", "GOOGLE_NON_JSON_RESPONSE", { operation: action, status: response.status }); }
        if (response.ok) return data;
        const code = String(data?.error?.message || "").split(" : ")[0];
        if (code === "EMAIL_EXISTS") throw authError(409, "EMAIL_ALREADY_USED", "Email already used");
        if (["INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND", "USER_DISABLED",
            "INVALID_ID_TOKEN", "TOKEN_EXPIRED"].includes(code)) {
            throw invalidCredentials();
        }
        if (code === "WEAK_PASSWORD" || code === "PASSWORD_DOES_NOT_MEET_REQUIREMENTS") {
            throw authError(422, "ACCOUNT_PASSWORD_REJECTED", "Choose a stronger password");
        }
        if (response.status === 429 || code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
            throw authError(429, "REPORT_EMAIL_CODE_COOLDOWN", "Wait before trying again");
        }
        throw failUnavailable("identity_toolkit", safeUpstreamReason(data?.error, code), { operation: action, status: response.status });
    }

    const signIn = (email, password) => request("signInWithPassword", { email, password, returnSecureToken: true });
    const signup = (email, password) => request("signUp", { email, password, returnSecureToken: true });
    const sendVerification = (idToken, locale) => request("sendOobCode", { requestType: "VERIFY_EMAIL", idToken }, locale);
    const sendReset = (email, locale) => request("sendOobCode", { requestType: "PASSWORD_RESET", email }, locale);

    async function verifySignIn(session, expectedEmail) {
        if (!session?.idToken || !session?.localId) throw failUnavailable("identity_toolkit", "GOOGLE_SESSION_INCOMPLETE");
        // accounts:lookup validates this Google-issued ID token before we trust its auth_time.
        const { users: accounts } = await request("lookup", { idToken: session.idToken });
        const identity = accounts?.[0];
        const claims = jwt.decode(session.idToken);
        if (identity?.localId !== session.localId || identity?.email?.toLowerCase() !== expectedEmail ||
            claims?.sub !== identity.localId || claims.aud !== settings.projectId ||
            claims.iss !== `https://securetoken.google.com/${settings.projectId}` ||
            !Number.isSafeInteger(claims.auth_time) || identity.disabled ||
            !Number.isFinite(Number(identity.validSince || 0)) || claims.auth_time < Number(identity.validSince || 0)) {
            throw invalidCredentials();
        }
        return { uid: session.localId, authTime: claims.auth_time, verified: identity.emailVerified === true };
    }

    async function isSessionCurrent(uid, email, authTime) {
        if (!Number.isSafeInteger(authTime) || authTime <= 0) return false;
        let record = users.get(uid);
        if (!record || record.expiresAt <= now()) {
            const getUser = requireAdmin();
            let user;
            try { user = await getUser(uid); }
            catch (error) {
                const status = error?.response?.status;
                throw failUnavailable("account_status", status === 403 ? "FIREBASE_VIEWER_PERMISSION_DENIED" : "FIREBASE_ACCOUNT_LOOKUP_FAILED",
                    Number.isInteger(status) ? { status } : {});
            }
            if (!user) return false;
            record = { user, expiresAt: now() + 30000 };
            if (users.size >= 2048) users.delete(users.keys().next().value);
            users.set(uid, record);
        }
        const { user } = record;
        const validAfter = Number(user.validSince || 0);
        return user.localId === uid && !user.disabled && user.emailVerified === true &&
            user.email?.toLowerCase() === email.toLowerCase() &&
            Number.isFinite(validAfter) && authTime >= validAfter;
    }

    return { signIn, signup, sendVerification, sendReset, verifySignIn, isSessionCurrent };
}

function loadAdmin(settings, readCredentials = readFileSync) {
    let raw, key;
    try { raw = readCredentials(settings.serviceAccountFile, "utf8"); }
    catch (error) {
        throw new CredentialFailure(error?.code === "ENOENT" ? "SECRET_FILE_NOT_FOUND" : "SECRET_FILE_UNREADABLE");
    }
    try { key = JSON.parse(raw); }
    catch { throw new CredentialFailure("SECRET_FILE_INVALID_JSON"); }
    if (key?.type !== "service_account") throw new CredentialFailure("SECRET_FILE_WRONG_TYPE");
    if (key.project_id !== settings.projectId) throw new CredentialFailure("SECRET_FILE_PROJECT_MISMATCH");
    if (!key.client_email || !key.private_key) throw new CredentialFailure("SECRET_FILE_FIELDS_MISSING");
    const client = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: ["https://www.googleapis.com/auth/identitytoolkit"],
    });
    return async (uid) => {
        const result = await client.request({
            url: `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(settings.projectId)}/accounts:lookup`,
            method: "POST",
            data: { localId: [uid] },
            timeout: 7000,
            retry: false,
        });
        return result.data?.users?.[0];
    };
}

module.exports = {
    authError,
    invalidCredentials,
    createFirebaseProvider,
    loadAdmin,
    firebaseProvider: createFirebaseProvider({ settings: config.firebaseAuth, loadAdmin }),
};
