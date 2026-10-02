const mongoose = require("mongoose");
const AnalysisRecord = require("../models/AnalysisRecord");

async function createHistoryRecord(req, res, next) {
  try {
    const installId = req.installId;
    const {
      analysisType = "text",
      sourceUrl = "",
      analyzedText = "",
      result = {},
      score = 0,
    } = req.body || {};

    if (!["text", "image"].includes(analysisType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid analysisType" });
    }

    const normalizedScore = Number(score);

    if (!Number.isFinite(normalizedScore)) {
      return res.status(400).json({ success: false, message: "Invalid score" });
    }
    if (normalizedScore < 0 || normalizedScore > 100) {
      return res
        .status(400)
        .json({ success: false, message: "Score must be between 0 and 100" });
    }

    const record = await AnalysisRecord.create({
      installId,
      analysisType,
      sourceUrl: String(sourceUrl || "").slice(0, 500),
      analyzedText: String(analyzedText || "").slice(0, 5000),
      result,
      score: normalizedScore,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: String(record._id),
        installId: record.installId,
        analysisType: record.analysisType,
        sourceUrl: record.sourceUrl,
        analyzedText: record.analyzedText,
        result: record.result,
        score: record.score,
        createdAt: record.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const installId = req.installId;
    const records = await AnalysisRecord.find({ installId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: records.map((record) => ({
        id: String(record._id),
        installId: record.installId,
        analysisType: record.analysisType,
        sourceUrl: record.sourceUrl,
        analyzedText: record.analyzedText,
        result: record.result,
        score: record.score,
        createdAt: record.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteHistoryById(req, res, next) {
  try {
    const installId = req.installId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid history id" });
    }

    const deleted = await AnalysisRecord.findOneAndDelete({
      _id: id,
      installId,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "History record not found" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
}

async function clearHistory(req, res, next) {
  try {
    const installId = req.installId;
    await AnalysisRecord.deleteMany({ installId });
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createHistoryRecord,
  getHistory,
  deleteHistoryById,
  clearHistory,
};
