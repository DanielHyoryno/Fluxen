const express = require("express");
const {
  postTelemetry,
  postTelemetryBatch,
  latestTelemetry,
  dailyTelemetry,
  usageHistory,
  exportCsv,
  exportXlsx,
} = require("../controllers/telemetry.controller");
const { requireDeviceToken } = require("../middlewares/device-auth.middleware");
const { requireAuth } = require("../middlewares/auth.middleware");
const { rateLimit } = require("../middlewares/rate-limit.middleware");

const router = express.Router();

// Device ingest — 30 requests per minute per device
const ingestLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
  keyFn: (req) => req.device?.device_code || req.ip,
});

router.post("/", requireDeviceToken, ingestLimiter, postTelemetry);
router.post("/batch", requireDeviceToken, ingestLimiter, postTelemetryBatch);
router.get("/latest", requireAuth, latestTelemetry);
router.get("/daily", requireAuth, dailyTelemetry);
router.get("/history", requireAuth, usageHistory);
router.get("/export", requireAuth, exportCsv);
router.get("/export-xlsx", requireAuth, exportXlsx);

module.exports = router;
