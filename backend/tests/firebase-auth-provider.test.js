const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { createFirebaseProvider } = require("../src/services/firebase-auth.provider");

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
