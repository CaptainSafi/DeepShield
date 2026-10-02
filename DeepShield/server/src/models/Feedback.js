const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    installId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalysisRecord",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    label: {
      type: String,
      enum: ["helpful", "incorrect", "uncertain", "other"],
      default: "other",
    },
    comment: {
      type: String,
      default: "",
      maxlength: 1000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

feedbackSchema.index({ installId: 1, createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
