const mongoose = require("mongoose");
const Feedback = require("../models/Feedback");
const AnalysisRecord = require("../models/AnalysisRecord");

function validateFeedbackPayload(payload = {}) {
  if (!payload.analysisId || !mongoose.Types.ObjectId.isValid(payload.analysisId)) {
    return "Valid analysisId is required";
  }

  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    return "Rating must be an integer between 1 and 5";
  }

  if (
    payload.label &&
    !["helpful", "incorrect", "uncertain", "other"].includes(payload.label)
  ) {
    return "Invalid label value";
  }

  if (payload.comment && payload.comment.length > 1000) {
    return "Comment is too long (max 1000 characters)";
  }

  return null;
}

async function createFeedback(req, res, next) {
  try {
    const installId = req.installId;
    const payload = {
      analysisId: req.body.analysisId,
      rating: Number(req.body.rating),
      label: req.body.label || "other",
      comment: req.body.comment || "",
    };

    const validationError = validateFeedbackPayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const relatedAnalysis = await AnalysisRecord.findOne({
      _id: payload.analysisId,
      installId,
    }).lean();
    if (!relatedAnalysis) {
      return res.status(404).json({
        success: false,
        message: "Related analysis record not found for this installId",
      });
    }

    const feedback = await Feedback.create({
      installId,
      analysisId: payload.analysisId,
      rating: payload.rating,
      label: payload.label,
      comment: payload.comment,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: String(feedback._id),
        installId: feedback.installId,
        analysisId: String(feedback.analysisId),
        rating: feedback.rating,
        label: feedback.label,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getFeedback(req, res, next) {
  try {
    const installId = req.installId;
    const feedbackList = await Feedback.find({ installId })
      .sort({ createdAt: -1 })
      .lean();

    const analysisIds = feedbackList.map((f) => f.analysisId);
    const relatedAnalyses = await AnalysisRecord.find({
      _id: { $in: analysisIds },
    }).lean();

    const analysisMap = relatedAnalyses.reduce((acc, analysis) => {
      acc[String(analysis._id)] = analysis;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: feedbackList.map((item) => {
        const analysis = analysisMap[String(item.analysisId)] || {};
        return {
          id: String(item._id),
          installId: item.installId,
          analysisId: String(item.analysisId),
          rating: item.rating,
          label: item.label,
          comment: item.comment,
          createdAt: item.createdAt,
          analysis: {
            type: analysis.analysisType,
            label: analysis.result?.label,
            score: analysis.score,
            confidence: analysis.result?.confidence,
            analysis_mode: analysis.result?.analysis_mode,
            sourceUrl: analysis.sourceUrl,
            analyzedText: analysis.analyzedText,
          },
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createFeedback, getFeedback };
