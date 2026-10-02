const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

/**
 * Optional auth middleware.
 * If a valid Bearer token is present, populates req.user and req.userId.
 * If no token (or invalid), continues without error — routes may still use req.installId.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.userId).select("-passwordHash");
    if (user) {
      req.user = user;
      req.userId = user._id.toString();
    }
  } catch {
    // Invalid/expired token — just ignore and continue unauthenticated
  }
  return next();
}

/**
 * Strict auth middleware. Returns 401 if no valid token.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.userId).select("-passwordHash");
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }
    req.user = user;
    req.userId = user._id.toString();
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

module.exports = { requireAuth, optionalAuth };
