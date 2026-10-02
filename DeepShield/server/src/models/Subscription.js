const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    installId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    tier: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
    licenseKey: {
      type: String,
      default: null,
      trim: true,
    },
    proActivatedAt: {
      type: Date,
      default: null,
    },
    proExpiresAt: {
      type: Date,
      default: null, // null = no expiry
    },
    // Anonymous usage totals (lifetime, used to enforce anon media limits)
    totalImagesScanned: { type: Number, default: 0 },
    totalVideosScanned: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
