const express = require("express");
const { getSettings, updateSettings } = require("../controllers/settingsController");
const { requireInstallId } = require("../middleware/installId");

const router = express.Router();

router.get("/", requireInstallId, getSettings);
router.put("/", requireInstallId, updateSettings);

module.exports = router;
