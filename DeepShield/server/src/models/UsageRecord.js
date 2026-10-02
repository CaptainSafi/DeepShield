const mongoose = require("mongoose");

// Tracks daily AI analysis usage per installId
const usageRecordSchema = new mongoose.Schema(
  {
    installId: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String, // "YYYY-MM-DD" UTC
      required: true,
    },
    aiAnalysisCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Unique per installId per day
usageRecordSchema.index({ installId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("UsageRecord", usageRecordSchema);
