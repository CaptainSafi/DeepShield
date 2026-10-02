const express = require("express");
const { requireInstallId } = require("../middleware/installId");
const {
  createHistoryRecord,
  getHistory,
  deleteHistoryById,
  clearHistory,
} = require("../controllers/historyController");

const router = express.Router();

router.post("/", requireInstallId, createHistoryRecord);
router.get("/", requireInstallId, getHistory);
router.delete("/:id", requireInstallId, deleteHistoryById);
router.delete("/", requireInstallId, clearHistory);

module.exports = router;
