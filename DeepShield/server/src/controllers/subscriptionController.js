const Subscription = require("../models/Subscription");
const UsageRecord = require("../models/UsageRecord");
const env = require("../config/env");

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function getOrCreateSubscription(installId) {
  let sub = await Subscription.findOne({ installId });
  if (!sub) {
    sub = await Subscription.create({ installId, tier: "free" });
  }
  return sub;
}

async function getSubscriptionStatus(req, res, next) {
  try {
    const installId = req.installId;
    const sub = await getOrCreateSubscription(installId);

    // Check if pro has expired
    if (sub.tier === "pro" && sub.proExpiresAt && sub.proExpiresAt < new Date()) {
      sub.tier = "free";
      await sub.save();
    }

    const aiLimit = sub.tier === "pro" ? Infinity : env.freeAiDailyLimit;
    const today = getTodayUTC();

    let aiUsedToday = 0;
    if (sub.tier === "free") {
      const usage = await UsageRecord.findOne({ installId, date: today });
      aiUsedToday = usage ? usage.aiAnalysisCount : 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        tier: sub.tier,
        aiUsedToday,
        aiLimit: sub.tier === "pro" ? -1 : env.freeAiDailyLimit, // -1 = unlimited
        canUseAI: sub.tier === "pro" || aiUsedToday < env.freeAiDailyLimit,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function activatePro(req, res, next) {
  try {
    const installId = req.installId;
    const { licenseKey } = req.body;

    if (!licenseKey || typeof licenseKey !== "string") {
      return res.status(400).json({ success: false, message: "License key is required" });
    }

    // Validate key format: DS-PRO-XXXXXXXX (placeholder — replace with Stripe or DB lookup)
    const isValid = /^DS-PRO-[A-Z0-9]{8,}$/i.test(licenseKey.trim());
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid license key format. Keys start with DS-PRO-",
      });
    }

    // Check key isn't already used by another installId
    const existing = await Subscription.findOne({
      licenseKey: licenseKey.trim().toUpperCase(),
      installId: { $ne: installId },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This license key is already activated on another device.",
      });
    }

    const sub = await getOrCreateSubscription(installId);
    sub.tier = "pro";
    sub.licenseKey = licenseKey.trim().toUpperCase();
    sub.proActivatedAt = new Date();
    sub.proExpiresAt = null; // Lifetime for now
    await sub.save();

    return res.status(200).json({
      success: true,
      message: "Pro activated successfully!",
      data: { tier: "pro" },
    });
  } catch (error) {
    return next(error);
  }
}

async function incrementAiUsage(installId) {
  const today = getTodayUTC();
  await UsageRecord.findOneAndUpdate(
    { installId, date: today },
    { $inc: { aiAnalysisCount: 1 } },
    { upsert: true }
  );
}

async function checkAiUsageAllowed(installId) {
  const sub = await getOrCreateSubscription(installId);
  if (sub.tier === "pro") return { allowed: true, tier: "pro" };

  const today = getTodayUTC();
  const usage = await UsageRecord.findOne({ installId, date: today });
  const count = usage ? usage.aiAnalysisCount : 0;

  return {
    allowed: count < env.freeAiDailyLimit,
    tier: "free",
    aiUsedToday: count,
    aiLimit: env.freeAiDailyLimit,
  };
}

module.exports = {
  getSubscriptionStatus,
  activatePro,
  incrementAiUsage,
  checkAiUsageAllowed,
};
