const express = require("express");
const { requireInstallId } = require("../middleware/installId");
const { createFeedback, getFeedback } = require("../controllers/feedbackController");

const router = express.Router();

router.post("/", requireInstallId, createFeedback);
router.get("/", requireInstallId, getFeedback);

module.exports = router;
