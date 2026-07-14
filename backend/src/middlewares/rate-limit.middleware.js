/**
 * Simple in-memory rate limiter middleware.
 *
 * No external dependencies — uses a Map with periodic cleanup.
 * Good enough for a single-server thesis project.
 *
 * Usage:
 *   const { rateLimit } = require("./middlewares/rate-limit.middleware");
 *   router.post("/batch", rateLimit({ windowMs: 60000, max: 30 }), handler);
 */

const { fail } = require("../utils/response");

function rateLimit({ windowMs = 60000, max = 60, keyFn } = {}) {
    const hits = new Map(); // key -> { count, resetAt }

    // Cleanup expired entries every minute
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (now >= entry.resetAt) hits.delete(key);
        }
    }, 60000);

    // Allow garbage collection if the process ends
    if (cleanup.unref) cleanup.unref();

    return function rateLimitMiddleware(req, res, next) {
        const key = keyFn ? keyFn(req) : req.device?.device_code || req.user?.id || req.ip;

        const now = Date.now();
        let entry = hits.get(key);

        if (!entry || now >= entry.resetAt) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }

        entry.count += 1;

        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
        res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

        if (entry.count > max) {
            return fail(res, "Too many requests, please slow down", 429, "RATE_LIMITED");
        }

        return next();
    };
}

module.exports = { rateLimit };
