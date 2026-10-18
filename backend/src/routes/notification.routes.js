const router = require("express").Router();
const { requireAuth } = require("../middlewares/auth.middleware");
const { rateLimit } = require("../middlewares/rate-limit.middleware");
const controller = require("../controllers/notification.controller");

router.use(requireAuth, rateLimit({ max: 30 }));
router.put("/push-token", controller.register);
router.delete("/push-token", controller.unregister);
module.exports = router;
