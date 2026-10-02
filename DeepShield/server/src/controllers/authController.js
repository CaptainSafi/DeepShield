const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

function signToken(userId) {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase().trim(), passwordHash });

    const token = signToken(user._id.toString());

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          plan: user.plan,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = signToken(user._id.toString());

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          plan: user.plan,
          isPro: user.isPro(),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getMe(req, res) {
  const user = req.user;
  const today = new Date().toISOString().slice(0, 10);
  const dailyUsage = user.dailyUsage?.date === today
    ? { images: user.dailyUsage.images, videos: user.dailyUsage.videos }
    : { images: 0, videos: 0 };

  return res.status(200).json({
    success: true,
    data: {
      id: user._id,
      email: user.email,
      plan: user.plan,
      isPro: user.isPro(),
      subscriptionStatus: user.subscriptionStatus,
      dailyUsage,
    },
  });
}

module.exports = { register, login, getMe };
