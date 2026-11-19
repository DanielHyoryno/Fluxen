const { readFileSync } = require("node:fs");
const { JWT } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const config = require("../config/env");

function authError(status, code, message) {
    return Object.assign(new Error(message), { status, code, reportEmailError: true });
}

const unavailable = () => authError(503, "ACCOUNT_EMAIL_UNAVAILABLE", "Firebase Auth is not available");
const invalidCredentials = () => authError(401, "INVALID_CREDENTIALS", "Invalid email or password");

function createFirebaseProvider({ settings, fetchImpl = (...args) => fetch(...args), now = Date.now, loadAdmin }) {
    const users = new Map();
    let admin;

    function requireAdmin() {
        if (!admin) {
            if (!settings.projectId || !settings.apiKey || !settings.serviceAccountFile) throw unavailable();
            try { admin = loadAdmin(settings); }
            catch { throw unavailable(); }
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
            data = await response.json();
        } catch {
            throw unavailable();
        }
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
        throw unavailable();
    }

    const signIn = (email, password) => request("signInWithPassword", { email, password, returnSecureToken: true });
    const signup = (email, password) => request("signUp", { email, password, returnSecureToken: true });
    const sendVerification = (idToken, locale) => request("sendOobCode", { requestType: "VERIFY_EMAIL", idToken }, locale);
    const sendReset = (email, locale) => request("sendOobCode", { requestType: "PASSWORD_RESET", email }, locale);

    async function verifySignIn(session, expectedEmail) {
        if (!session?.idToken || !session?.localId) throw unavailable();
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
            let user;
            try { user = await requireAdmin()(uid); }
            catch { throw unavailable(); }
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

function loadAdmin(settings) {
    // Refuse credentials from any other project before making requests. The
    // service account only needs permission to read Firebase Auth users.
    const key = JSON.parse(readFileSync(settings.serviceAccountFile, "utf8"));
    if (key.type !== "service_account" || key.project_id !== settings.projectId || !key.client_email || !key.private_key) {
        throw unavailable();
    }
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
    firebaseProvider: createFirebaseProvider({ settings: config.firebaseAuth, loadAdmin }),
};
