const express = require("express");
const { checkAndIncrementMedia, getMediaUsage } = require("../controllers/mediaUsageController");
const { requireInstallId } = require("../middleware/installId");
const { optionalAuth } = require("../middleware/requireAuth");

const router = express.Router();

// optionalAuth first so req.user is set if token provided
router.use(optionalAuth);
router.use(requireInstallId);

router.post("/check", checkAndIncrementMedia);
router.get("/usage", getMediaUsage);

module.exports = router;
