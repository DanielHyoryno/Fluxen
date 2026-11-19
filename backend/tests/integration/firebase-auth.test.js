const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "../../.env.test") });

const databaseUrl = process.env.TEST_DATABASE_URL;

test("Firebase links require email proof; legacy devices stay with their original owner", { skip: !databaseUrl }, async () => {
    assert.match(new URL(databaseUrl).hostname, /^(localhost|127\.0\.0\.1|\[::1\])$/);
    const schema = `fluxen_firebase_${randomBytes(5).toString("hex")}_test`;
    const bootstrap = new Pool({ connectionString: databaseUrl, ssl: false });
    let pool, server, schemaCreated;
    try {
        await bootstrap.query(`CREATE SCHEMA ${schema}`);
        schemaCreated = true;
        Object.assign(process.env, {
            NODE_ENV: "test", DB_SSL: "false", DB_SCHEMA: schema, DATABASE_URL: databaseUrl,
            JWT_SECRET: "integration-fixture-only", FIREBASE_AUTH_ENABLED: "false", ACCOUNT_EMAIL_ENABLED: "false",
            REPORT_EMAIL_ENABLED: "false", PUSH_NOTIFICATIONS_ENABLED: "true",
        });
        pool = require("../../src/config/db");
        await pool.query(fs.readFileSync(path.join(__dirname, "../fixtures/schema.sql"), "utf8"));
        for (const name of ["004_push_subscription.sql", "006_account_email_security.sql", "007_firebase_auth_link.sql", "007_firebase_auth_link.sql"]) {
            await pool.query(fs.readFileSync(path.join(__dirname, "../../sql/migrations", name), "utf8"));
        }
        const env = require("../../src/config/env");
        const { firebaseProvider, authError, invalidCredentials } = require("../../src/services/firebase-auth.provider");
        const accounts = new Map();
        let time = 100;
        let verifications = 0;
        let resetEmails = 0;
        Object.assign(firebaseProvider, {
            signup: async (email, password) => {
                if (accounts.has(email)) throw authError(409, "EMAIL_ALREADY_USED", "Email already used");
                const account = { uid: `uid-${accounts.size}`, password, verified: false, validSince: 0 };
                accounts.set(email, account);
                return { idToken: email, localId: account.uid };
            },
            signIn: async (email, password) => {
                if (accounts.get(email)?.password !== password) throw invalidCredentials();
                return { idToken: email, localId: accounts.get(email).uid };
            },
            verifySignIn: async (session, email) => {
                assert.equal(session.idToken, email);
                return { uid: session.localId, verified: accounts.get(email).verified, authTime: ++time };
            },
            sendVerification: async () => { verifications++; },
            sendReset: async (email) => { if (accounts.has(email)) resetEmails++; },
            isSessionCurrent: async (uid, email, at) => {
                const account = accounts.get(email);
                return account?.uid === uid && account.verified && at >= account.validSince;
            },
        });
        const app = require("../../src/app");
        await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
        const base = `http://127.0.0.1:${server.address().port}/api/v1`;
        const ask = async (route, body, token, supportsLinks = true, method = body ? "POST" : "GET") => {
            const response = await fetch(base + route, {
                method,
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(body ? { "Content-Type": "application/json" } : {}),
                    ...(supportsLinks ? { "X-Fluxen-Auth-Link": "1" } : {}) },
                body: body && JSON.stringify(body),
            });
            return { status: response.status, ...await response.json() };
        };
        const legacy = { full_name: "Legacy Owner", email: "legacy@example.test", password: "legacy-password" };
        const signup = { full_name: "New Owner", email: "signup@example.test", password: "signup-password" };
        const existing = await ask("/auth/register", legacy);
        const { user: oldUser, access_token: oldToken } = existing.data;
        assert.equal((await ask("/devices", { device_code: "FIREBASE-LINK-01", device_name: "Existing Meter" }, oldToken)).status, 201);
        env.firebaseAuth.enabled = true;

        assert.equal((await ask("/auth/register", signup, null, false)).status, 426);
        assert.equal((await ask("/auth/register", legacy)).status, 409);
        assert.equal((await ask("/auth/register", signup)).data.verification_method, "link");
        assert.equal((await ask("/auth/firebase/register/confirm", signup)).error_code, "ACCOUNT_EMAIL_NOT_VERIFIED");
        assert.equal((await pool.query("SELECT 1 FROM users WHERE email = $1", [signup.email])).rowCount, 0);
        accounts.get(signup.email).verified = true;
        assert.equal((await ask("/auth/firebase/register/confirm", signup)).status, 201);
        assert.equal((await pool.query("SELECT password_hash FROM users WHERE email = $1", [signup.email])).rows[0].password_hash, null);

        assert.equal((await ask("/auth/firebase/link/request", { password: legacy.password })).status, 401);
        assert.equal((await ask("/auth/firebase/link/request", { password: "wrong" }, oldToken)).error_code, "ACCOUNT_LINK_PASSWORD_INVALID");
        assert.equal(verifications, 1);
        assert.equal((await ask("/auth/firebase/link/request", { password: legacy.password }, oldToken)).status, 202);
        assert.equal((await ask("/auth/firebase/link/confirm", { password: legacy.password }, oldToken)).status, 403);
        accounts.get(legacy.email).verified = true;
        const linked = await ask("/auth/firebase/link/confirm", { password: legacy.password }, oldToken);
        assert.equal(linked.data.user.id, oldUser.id);
        const token = linked.data.access_token;
        assert.equal((await ask("/auth/me", null, oldToken)).status, 401);
        assert.equal((await ask("/devices", null, token)).data.items[0].device_code, "FIREBASE-LINK-01");
        const lookup = await pool.query("SELECT password_hash, firebase_uid FROM users WHERE id = $1", [oldUser.id]);
        assert.deepEqual(lookup.rows[0], { password_hash: null, firebase_uid: accounts.get(legacy.email).uid });
        assert.equal((await ask("/notifications/push-token", { token: "ExpoPushToken[linked-fixture]" }, token, true, "PUT")).status, 200);
        const { rows: [{ push_subscription: pushRecord }] } = await pool.query("SELECT push_subscription FROM users WHERE id = $1", [oldUser.id]);
        assert.ok(Number.isSafeInteger(pushRecord.firebase_auth_time));
        const reset = (email) => ask("/auth/password-reset/request", { email, locale: "id" });
        assert.deepEqual(await reset(legacy.email), await reset("unknown@example.test"));
        assert.equal(resetEmails, 1);

        const account = accounts.get(legacy.email);
        account.validSince = ++time;
        account.password = "reset-password";
        assert.equal((await ask("/auth/me", null, token)).status, 401);
        assert.equal((await ask("/auth/login", { email: legacy.email, password: legacy.password })).status, 401);
        const newLogin = await ask("/auth/login", { email: legacy.email, password: account.password });
        assert.equal(newLogin.data.user.id, oldUser.id);
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (pool) await pool.end();
        if (schemaCreated) await bootstrap.query(`DROP SCHEMA ${schema} CASCADE`);
        await bootstrap.end();
    }
});
