const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { authError, firebaseProvider, invalidCredentials } = require("./firebase-auth.provider");

const address = email => email.trim().toLowerCase();
const duplicate = () => authError(409, "EMAIL_ALREADY_USED", "Email already used");
const unverified = () => authError(403, "ACCOUNT_EMAIL_NOT_VERIFIED", "Open the verification link before continuing");
const linkPasswordError = () => authError(422, "ACCOUNT_LINK_PASSWORD_INVALID", "Enter the current Fluxen password");
const linkConflict = () => authError(409, "ACCOUNT_LINK_CONFLICT", "The email could not be linked to this account");

function createFirebaseAccountService({ db, provider }) {
    async function localAccount(email) {
        const { rows } = await db.query("SELECT firebase_uid FROM users WHERE email = $1 LIMIT 1", [email]);
        return rows[0];
    }

    async function sendVerification({ email, password, locale }) {
        // The identity may already be pending, e.g. when a user reopens the app.
        let session;
        try { session = await provider.signup(email, password); }
        catch (error) {
            if (error.code !== "EMAIL_ALREADY_USED") throw error;
            try { session = await provider.signIn(email, password); }
            catch (error) {
                if (error.code === "INVALID_CREDENTIALS") throw duplicate();
                throw error;
            }
        }
        const identity = await provider.verifySignIn(session, email);
        if (!identity.verified) await provider.sendVerification(session.idToken, locale);
    }

    async function requestRegistration({ email, password, locale }) {
        email = address(email);
        if (await localAccount(email)) throw duplicate();
        await sendVerification({ email, password, locale });
        return { email, verification_required: true, verification_method: "link" };
    }

    async function confirmRegistration({ full_name, email, password }) {
        email = address(email);
        if (await localAccount(email)) throw duplicate();
        const identity = await provider.verifySignIn(await provider.signIn(email, password), email);
        if (!identity.verified) throw unverified();
        const { rows } = await db.query(
            `INSERT INTO users (full_name, email, firebase_uid) VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING RETURNING id, full_name, email, role, created_at`,
            [full_name.trim(), email, identity.uid]
        );
        if (!rows[0]) throw duplicate();
        return { user: rows[0] };
    }

    async function verifyPassword(user, password) {
        const identity = await provider.verifySignIn(await provider.signIn(user.email, password), user.email);
        if (identity.uid !== user.firebase_uid || !identity.verified) throw invalidCredentials();
        return identity.authTime;
    }

    async function getLinkStatus(user) {
        const local = await localAccount(user.email);
        return {
            email: user.email,
            verified: Boolean(local?.firebase_uid),
            verification_method: "link",
            delivery_enabled: false,
        };
    }

    async function checkLegacyPassword(user, password) {
        const { rows: [legacy] } = await db.query(
            "SELECT password_hash, firebase_uid FROM users WHERE id = $1 AND email = $2",
            [user.id, user.email]
        );
        if (legacy?.firebase_uid) throw linkConflict();
        if (!legacy?.password_hash || !await bcrypt.compare(password, legacy.password_hash)) throw linkPasswordError();
        return legacy.password_hash;
    }

    async function requestLink(user, { password, locale }) {
        await checkLegacyPassword(user, password);
        await sendVerification({ email: user.email, password, locale });
        return { email: user.email };
    }

    async function confirmLink(user, { password }, createSession) {
        const hash = await checkLegacyPassword(user, password);
        const identity = await provider.verifySignIn(await provider.signIn(user.email, password), user.email);
        if (!identity.verified) throw unverified();
        let updated;
        try {
            ({ rows: [updated] } = await db.query(
                `UPDATE users SET firebase_uid = $3, password_hash = NULL, session_version = session_version + 1, push_subscription = NULL,
                  updated_at = NOW() WHERE id = $1 AND email = $2 AND firebase_uid IS NULL AND password_hash = $4
                 RETURNING id, full_name, email, role, created_at, firebase_uid, session_version`,
                [user.id, user.email, identity.uid, hash]
            ));
        } catch (error) {
            if (error.code === "23505") throw linkConflict();
            throw error;
        }
        if (!updated) throw linkConflict();
        return createSession(updated, identity.authTime);
    }

    async function requestReset({ email, locale }) {
        email = address(email);
        const local = await localAccount(email);
        // An old, unverified email alone may not take over a legacy user's devices.
        if (!local || local.firebase_uid) {
            try { await provider.sendReset(email, locale); }
            catch (error) {
                // Keep the public response indistinguishable for existing and unknown accounts.
                if (error.status >= 500) console.warn("Firebase did not accept a reset email");
            }
        }
        return { accepted: true, verification_method: "link" };
    }

    return { requestRegistration, confirmRegistration, verifyPassword, getLinkStatus, requestLink, confirmLink, requestReset };
}

module.exports = {
    createFirebaseAccountService,
    firebaseAccount: createFirebaseAccountService({ db: pool, provider: firebaseProvider }),
};
