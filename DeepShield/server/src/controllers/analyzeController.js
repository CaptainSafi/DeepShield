const openRouterService = require("../services/openRouterService");
const { checkAiUsageAllowed, incrementAiUsage } = require("./subscriptionController");

const analyzeTextAI = async (req, res, next) => {
  try {
    const { text } = req.body;
    const installId = req.installId;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required for analysis",
      });
    }

    if (text.length < 10) {
      return res.status(400).json({
        success: false,
        error: "Text too short for analysis (minimum 10 characters required)",
      });
    }

    // Check subscription / daily limit
    const usageCheck = await checkAiUsageAllowed(installId);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        upgradeRequired: true,
        error: `Daily AI limit reached (${usageCheck.aiLimit} scans/day on Free plan). Upgrade to Pro for unlimited scans.`,
        data: {
          aiUsedToday: usageCheck.aiUsedToday,
          aiLimit: usageCheck.aiLimit,
        },
      });
    }

    const result = await openRouterService.analyzeText(text);

    // Increment usage counter (only after a successful call)
    if (usageCheck.tier === "free") {
      await incrementAiUsage(installId).catch(() => {}); // non-blocking, don't fail the request
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeTextAI,
};
