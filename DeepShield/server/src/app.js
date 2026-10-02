const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const healthRoutes = require("./routes/healthRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const historyRoutes = require("./routes/historyRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const analyzeRoutes = require("./routes/analyzeRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const authRoutes = require("./routes/authRoutes");
const stripeRoutes = require("./routes/stripeRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const { sanitizeInput } = require("./middleware/sanitizeInput");
const { rateLimit } = require("./middleware/rateLimit");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin,
  })
);

// Stripe webhook must receive raw body — register BEFORE express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(rateLimit);
app.use(sanitizeInput);

app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Deep Shield API" });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/analyze", analyzeRoutes);
app.use("/api/subscription", subscriptionRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
