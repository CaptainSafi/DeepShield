const mongoose = require("mongoose");

const analysisRecordSchema = new mongoose.Schema(
  {
    installId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    analysisType: {
      type: String,
      enum: ["text", "image", "video"],
      required: true,
    },
    analysisMode: {
      type: String,
      default: "",
      trim: true,
    },
    sourceUrl: {
      type: String,
      default: "",
      trim: true,
    },
    analyzedText: {
      type: String,
      default: "",
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

analysisRecordSchema.index({ installId: 1, createdAt: -1 });

module.exports = mongoose.model("AnalysisRecord", analysisRecordSchema);
