const express = require("express");
const {
    createOwnedDevice,
    listOwnedDevices,
    getOwnedDevice,
    updateOwnedDevice,
    deleteOwnedDevice,
} = require("../controllers/device.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(requireAuth);
router.post("/", createOwnedDevice);
router.get("/", listOwnedDevices);
router.get("/:id", getOwnedDevice);
router.patch("/:id", updateOwnedDevice);
router.delete("/:id", deleteOwnedDevice);

module.exports = router;
