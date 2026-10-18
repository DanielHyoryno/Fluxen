const pool = require("../config/db");

async function registerPushSubscription(userId, { token, locale }, expiresAt) {
    if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) throw new Error("INVALID_PUSH_SESSION");
    const subscription = { token, locale, expires_at: new Date(expiresAt * 1000).toISOString() };
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // Serialize ownership transfers for this phone, including simultaneous account switches.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [token]);
        await client.query(
            "UPDATE users SET push_subscription = NULL WHERE id <> $1 AND push_subscription->>'token' = $2",
            [userId, token]
        );
        await client.query("UPDATE users SET push_subscription = $2::jsonb WHERE id = $1", [userId, JSON.stringify(subscription)]);
        await client.query("COMMIT");
        return { registered: true, receiving_phones: 1 };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
}

async function unregisterPushSubscription(userId, token) {
    // An old phone/session must not detach a newer registration.
    await pool.query("UPDATE users SET push_subscription = NULL WHERE id = $1 AND push_subscription->>'token' = $2", [userId, token]);
    return { registered: false };
}

module.exports = { registerPushSubscription, unregisterPushSubscription };
