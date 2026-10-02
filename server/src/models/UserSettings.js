const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema(
  {
    installId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    highlightEnabled: {
      type: Boolean,
      default: true,
    },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    scoreThreshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    analysisMode: {
      type: String,
      enum: ["classic", "ai"],
      default: "classic",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserSettings", userSettingsSchema);
