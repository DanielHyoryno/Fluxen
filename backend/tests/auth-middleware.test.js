const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
let query = async () => ({ rows: [{ id: "1" }], rowCount: 1 });
require.cache[require.resolve("../src/config/db")] = { exports: { query: (...args) => query(...args) } };
require.cache[require.resolve("../src/services/auth.service")] = { exports: { getJwtSecret: () => "test-auth-secret" } };
const { requireAuth } = require("../src/middlewares/auth.middleware");
function response() { return { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

test("missing or invalid credentials return 401", async () => {
    for (const header of [undefined, "Bearer broken"]) {
        const res = response();
        await requireAuth({ headers: { authorization: header } }, res, () => assert.fail("must not authorize"));
        assert.equal(res.statusCode, 401);
    }
});
test("database failure returns 503, not a false expired-session response", async () => {
    query = async () => { throw Object.assign(new Error("offline"), { code: "ECONNREFUSED" }); };
    const res = response();
    await requireAuth({ headers: { authorization: `Bearer ${jwt.sign({ sub: "1" }, "test-auth-secret", { expiresIn: "1h" })}` } }, res, () => assert.fail("must not authorize"));
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error_code, "AUTH_UNAVAILABLE");
});
test("valid sessions attach the verified expiry used by push subscriptions", async () => {
    query = async () => ({ rows: [{ id: "1" }], rowCount: 1 });
    const req = { headers: { authorization: `Bearer ${jwt.sign({ sub: "1" }, "test-auth-secret", { expiresIn: "1h" })}` } };
    let called = false;
    await requireAuth(req, response(), () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.user.id, "1");
    assert.ok(req.auth.expiresAt > Date.now() / 1000);
});
