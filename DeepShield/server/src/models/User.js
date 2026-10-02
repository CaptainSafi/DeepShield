const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Stripe
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ["none", "active", "trialing", "past_due", "canceled", "unpaid"],
      default: "none",
    },
    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
    planExpiresAt: { type: Date, default: null },
    // Daily usage (resets each day via getTodayUTC key)
    dailyUsage: {
      date: { type: String, default: null },         // "YYYY-MM-DD"
      images: { type: Number, default: 0 },
      videos: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.methods.isPro = function () {
  if (this.plan !== "pro") return false;
  if (this.planExpiresAt && this.planExpiresAt < new Date()) return false;
  return ["active", "trialing"].includes(this.subscriptionStatus);
};

module.exports = mongoose.model("User", userSchema);
