const express = require("express");
const router = express.Router();
const analyzeController = require("../controllers/analyzeController");
const { requireInstallId } = require("../middleware/installId");

router.post("/ai", requireInstallId, analyzeController.analyzeTextAI);

module.exports = router;
