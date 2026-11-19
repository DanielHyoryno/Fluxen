const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createFirebaseProvider, loadAdmin } = require("../src/services/firebase-auth.provider");

test("Firebase session uses the expected project and detects external password reset after cache expiry", async () => {
    const projectId = "fluxen-fixture";
    const email = "tester@example.test";
    const uid = "fixture-uid";
    let now = 1000000;
    let revokedAfter = 900;
    const firebaseToken = (aud = projectId) => jwt.sign(
        { sub: uid, aud, iss: `https://securetoken.google.com/${aud}`, auth_time: 1000 }, "mock-only"
    );
    const user = () => ({ localId: uid, email, emailVerified: true, validSince: String(revokedAfter) });
    const urls = [];
    const provider = createFirebaseProvider({
        settings: { projectId, apiKey: "fixture-only", serviceAccountFile: "fixture-only" },
        now: () => now,
        loadAdmin: () => async (id) => { assert.equal(id, uid); return user(); },
        fetchImpl: async (url, options) => {
            const body = JSON.parse(options.body);
            urls.push([url.pathname, body, options.headers["X-Firebase-Locale"]]);
            assert.equal(url.origin, "https://identitytoolkit.googleapis.com");
            assert.equal(url.searchParams.get("key"), "fixture-only");
            if (url.pathname.endsWith(":lookup")) return new Response(JSON.stringify({ users: [user()] }));
            if (url.pathname.endsWith(":sendOobCode")) return new Response("{}");
            throw new Error("Unexpected request");
        },
    });
    await assert.rejects(provider.verifySignIn({ localId: uid, idToken: firebaseToken("other-project") }, email), { code: "INVALID_CREDENTIALS" });
    const idToken = firebaseToken();
    assert.deepEqual(await provider.verifySignIn({ localId: uid, idToken }, email), { uid, authTime: 1000, verified: true });
    await provider.sendVerification(idToken, "id");
    await provider.sendReset(email, "en");
    assert.deepEqual(urls.slice(-2), [
        ["/v1/accounts:sendOobCode", { requestType: "VERIFY_EMAIL", idToken }, "id"],
        ["/v1/accounts:sendOobCode", { requestType: "PASSWORD_RESET", email }, "en"],
    ]);
    assert.equal(await provider.isSessionCurrent(uid, email, 1000), true);
    revokedAfter = 1001;
    now += 31000;
    assert.equal(await provider.isSessionCurrent(uid, email, 1000), false);
    assert.equal(await provider.isSessionCurrent(uid, email, 1002), true);
    assert.equal(await provider.isSessionCurrent(uid, "other@example.test", 1002), false);
});

test("diagnostic simulations distinguish configuration, file, and Google failures without leaking secrets", async (t) => {
    const settings = { projectId: "fluxen-fixture", apiKey: "DO_NOT_LOG_KEY", serviceAccountFile: "/etc/secrets/DO_NOT_LOG_PATH" };
    const validFixture = {
        type: "service_account", project_id: settings.projectId,
        client_email: "DO_NOT_LOG_IDENTITY@example.test", private_key: "DO_NOT_LOG_PEM",
    };
    const providerFailure = (details = [], message = "DO_NOT_LOG_UPSTREAM_BODY") => async () =>
        new Response(JSON.stringify({ error: { details, message } }), { status: 403 });
    const goodFile = () => JSON.stringify(validFixture);
    const cases = [
        { name: "missing Render value", settings: { ...settings, apiKey: "" }, expected: {
            stage: "configuration", reason: "ENVIRONMENT_MISSING", missing: ["FIREBASE_AUTH_API_KEY"],
        } },
        { name: "missing secret file", read: () => { throw Object.assign(new Error("DO_NOT_LOG_PATH"), { code: "ENOENT" }); }, expected: {
            stage: "credentials", reason: "SECRET_FILE_NOT_FOUND",
        } },
        { name: "malformed JSON", read: () => "{ DO_NOT_LOG_PEM", expected: {
            stage: "credentials", reason: "SECRET_FILE_INVALID_JSON",
        } },
        { name: "wrong Google project", read: () => JSON.stringify({ ...validFixture, project_id: "other" }), expected: {
            stage: "credentials", reason: "SECRET_FILE_PROJECT_MISMATCH",
        } },
        { name: "API key restriction", fetchImpl: providerFailure([{ reason: "API_KEY_SERVICE_BLOCKED" }]), expected: {
            stage: "identity_toolkit", reason: "API_KEY_SERVICE_BLOCKED", operation: "signInWithPassword", status: 403,
        } },
        { name: "unknown upstream error", fetchImpl: providerFailure([{ reason: "DO_NOT_LOG_KEY" }]), expected: {
            stage: "identity_toolkit", reason: "GOOGLE_REQUEST_REJECTED", operation: "signInWithPassword", status: 403,
        } },
        { name: "timeout", fetchImpl: async () => { throw new DOMException("DO_NOT_LOG_KEY", "TimeoutError"); }, expected: {
            stage: "identity_toolkit", reason: "GOOGLE_TIMEOUT", operation: "signInWithPassword",
        } },
    ];
    for (const scenario of cases) {
        await t.test(scenario.name, async () => {
            const logs = [];
            const provider = createFirebaseProvider({
                settings: scenario.settings || settings,
                loadAdmin: cfg => loadAdmin(cfg, scenario.read || goodFile),
                fetchImpl: scenario.fetchImpl || (() => assert.fail("Configuration failure must not reach Google")),
                warn: event => logs.push(event),
            });
            for (let count = 0; count < 2; count++) {
                await assert.rejects(provider.signIn("DO_NOT_LOG_EMAIL@example.test", "DO_NOT_LOG_PASSWORD"),
                    { status: 503, code: "ACCOUNT_EMAIL_UNAVAILABLE" });
            }
            assert.deepEqual(logs, [scenario.expected]);
            assert.doesNotMatch(JSON.stringify(logs), /DO_NOT_LOG/);
            t.diagnostic(JSON.stringify(logs[0]));
        });
    }
});
