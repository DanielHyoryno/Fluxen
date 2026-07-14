const express = require("express");
const { requireAuth } = require("../middlewares/auth.middleware");
const {
    listOwnedCategories,
    createOwnedCategory,
    updateOwnedCategory,
    deleteOwnedCategory,
} = require("../controllers/category.controller");

const router = express.Router();

router.use(requireAuth);
router.get("/", listOwnedCategories);
router.post("/", createOwnedCategory);
router.patch("/:id", updateOwnedCategory);
router.delete("/:id", deleteOwnedCategory);

module.exports = router;
