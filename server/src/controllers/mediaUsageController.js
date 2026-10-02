/**
 * Media usage controller.
 * Enforces per-tier limits for image and video scans.
 *
 * Tiers:
 *  - Anonymous (installId only): 5 images OR 1 video, lifetime total
 *  - Free registered user:       10 images/day + 3 videos/day
 *  - Pro user:                   unlimited
 */
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const env = require("../config/env");

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/media/check
 * Body: { type: "image" | "video" }
 * Returns { allowed: true } or { allowed: false, reason, upgradeRequired, authRequired }
 */
async function checkAndIncrementMedia(req, res, next) {
  try {
    const { type } = req.body;
    if (!["image", "video"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be 'image' or 'video'" });
    }

    const user = req.user || null;

    // ── Authenticated user ──────────────────────────────────────────────────
    if (user) {
      if (user.isPro()) {
        return res.status(200).json({ success: true, data: { allowed: true } });
      }

      // Free registered user — daily limits
      const today = getTodayUTC();
      // Reset daily counters if it's a new day
      if (user.dailyUsage?.date !== today) {
        user.dailyUsage = { date: today, images: 0, videos: 0 };
      }

      const dailyImages = user.dailyUsage.images || 0;
      const dailyVideos = user.dailyUsage.videos || 0;

      if (type === "image" && dailyImages >= env.freeUserDailyImages) {
        return res.status(429).json({
          success: false,
          data: { allowed: false, reason: "daily_limit_reached", upgradeRequired: true },
          message: `Free plan: ${env.freeUserDailyImages} image scans per day. Upgrade to Pro for unlimited.`,
        });
      }
      if (type === "video" && dailyVideos >= env.freeUserDailyVideos) {
        return res.status(429).json({
          success: false,
          data: { allowed: false, reason: "daily_limit_reached", upgradeRequired: true },
          message: `Free plan: ${env.freeUserDailyVideos} video scans per day. Upgrade to Pro for unlimited.`,
        });
      }

      // Increment
      if (type === "image") user.dailyUsage.images += 1;
      else user.dailyUsage.videos += 1;
      user.markModified("dailyUsage");
      await user.save();

      return res.status(200).json({ success: true, data: { allowed: true } });
    }

    // ── Anonymous user (installId only) ────────────────────────────────────
    const installId = req.installId;
    if (!installId) {
      return res.status(400).json({ success: false, message: "No identity (installId or auth token) provided." });
    }

    let sub = await Subscription.findOne({ installId });
    if (!sub) {
      sub = await Subscription.create({ installId, tier: "free", totalImagesScanned: 0, totalVideosScanned: 0 });
    }

    const totalImages = sub.totalImagesScanned || 0;
    const totalVideos = sub.totalVideosScanned || 0;

    if (type === "image" && totalImages >= env.anonFreeImages) {
      return res.status(429).json({
        success: false,
        data: { allowed: false, reason: "anon_limit_reached", authRequired: true },
        message: `You've used all ${env.anonFreeImages} free image scans. Create a free account to continue.`,
      });
    }
    if (type === "video" && totalVideos >= env.anonFreeVideos) {
      return res.status(429).json({
        success: false,
        data: { allowed: false, reason: "anon_limit_reached", authRequired: true },
        message: `You've used your ${env.anonFreeVideos} free video scan. Create a free account to continue.`,
      });
    }

    // Increment
    if (type === "image") sub.totalImagesScanned += 1;
    else sub.totalVideosScanned += 1;
    await sub.save();

    return res.status(200).json({ success: true, data: { allowed: true } });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/media/usage
 * Returns current media usage for the caller (anon or registered).
 */
async function getMediaUsage(req, res, next) {
  try {
    const user = req.user || null;

    if (user) {
      const today = getTodayUTC();
      const usage = user.dailyUsage?.date === today
        ? { images: user.dailyUsage.images, videos: user.dailyUsage.videos }
        : { images: 0, videos: 0 };

      return res.status(200).json({
        success: true,
        data: {
          type: "registered",
          plan: user.plan,
          isPro: user.isPro(),
          dailyUsage: usage,
          dailyLimits: user.isPro()
            ? { images: -1, videos: -1 }
            : { images: env.freeUserDailyImages, videos: env.freeUserDailyVideos },
        },
      });
    }

    const installId = req.installId;
    if (!installId) {
      return res.status(200).json({
        success: true,
        data: {
          type: "anonymous",
          totalUsage: { images: 0, videos: 0 },
          totalLimits: { images: env.anonFreeImages, videos: env.anonFreeVideos },
        },
      });
    }

    const sub = await Subscription.findOne({ installId });
    return res.status(200).json({
      success: true,
      data: {
        type: "anonymous",
        totalUsage: {
          images: sub?.totalImagesScanned || 0,
          videos: sub?.totalVideosScanned || 0,
        },
        totalLimits: { images: env.anonFreeImages, videos: env.anonFreeVideos },
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { checkAndIncrementMedia, getMediaUsage };
