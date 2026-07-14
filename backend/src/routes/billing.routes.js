const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const {
    getOwnedBillingSettings,
    upsertOwnedBillingSettings,
    estimateOwnedBill,
} = require("../controllers/billing.controller");

const router = express.Router();

router.use(requireAuth);
router.get("/settings", getOwnedBillingSettings);
router.put("/settings", upsertOwnedBillingSettings);
router.post("/estimate", estimateOwnedBill);

module.exports = router;
