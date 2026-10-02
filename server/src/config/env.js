const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongodbUri:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai-detector",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 120,
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  freeAiDailyLimit: Number(process.env.FREE_AI_DAILY_LIMIT) || 5,
  // Auth
  jwtSecret: process.env.JWT_SECRET || "change-this-jwt-secret-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripePriceId: process.env.STRIPE_PRICE_ID || "",  // monthly pro plan price ID
  stripeSuccessUrl: process.env.STRIPE_SUCCESS_URL || "http://localhost:5000/api/stripe/success",
  stripeCancelUrl:  process.env.STRIPE_CANCEL_URL  || "http://localhost:5000/api/stripe/cancel",
  // Usage limits
  anonFreeImages: Number(process.env.ANON_FREE_IMAGES) || 5,   // total lifetime for anonymous
  anonFreeVideos: Number(process.env.ANON_FREE_VIDEOS) || 1,   // total lifetime for anonymous
  freeUserDailyImages: Number(process.env.FREE_USER_DAILY_IMAGES) || 10, // registered free user, daily
  freeUserDailyVideos: Number(process.env.FREE_USER_DAILY_VIDEOS) || 3,  // registered free user, daily
};

module.exports = env;
