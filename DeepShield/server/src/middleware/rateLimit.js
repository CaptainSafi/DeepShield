const env = require("../config/env");

const requestStore = new Map();

function rateLimit(req, res, next) {
  const installId = req.header("x-install-id");
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
  const key = installId ? `install:${installId}` : `ip:${clientIp}`;
  const now = Date.now();

  const existing = requestStore.get(key) || {
    count: 0,
    resetAt: now + env.rateLimitWindowMs,
  };

  if (now > existing.resetAt) {
    existing.count = 0;
    existing.resetAt = now + env.rateLimitWindowMs;
  }

  existing.count += 1;
  requestStore.set(key, existing);

  if (existing.count > env.rateLimitMaxRequests) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again shortly.",
    });
  }

  return next();
}

module.exports = { rateLimit };
