const express = require("express");
const router = express.Router();
const { getSubscriptionStatus, activatePro } = require("../controllers/subscriptionController");
const { requireInstallId } = require("../middleware/installId");

router.get("/", requireInstallId, getSubscriptionStatus);
router.post("/activate", requireInstallId, activatePro);

module.exports = router;
