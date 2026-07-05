const express = require("express");
const {
  getDeviceUsageLimits,
  upsertDeviceUsageLimits,
  getUsageAlerts,
  getAllUsageAlerts,
  dismissUsageAlert,
} = require("../controllers/usage.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(requireAuth);
router.get("/limits", getDeviceUsageLimits);
router.put("/limits", upsertDeviceUsageLimits);
router.get("/alerts-all", getAllUsageAlerts);
router.get("/alerts", getUsageAlerts);
router.patch("/alerts/:alert_id/dismiss", dismissUsageAlert);

module.exports = router;
