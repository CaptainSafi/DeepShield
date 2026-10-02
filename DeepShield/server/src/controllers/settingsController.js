const UserSettings = require("../models/UserSettings");

const DEFAULT_SETTINGS = {
  highlightEnabled: true,
  theme: "system",
  scoreThreshold: 50,
  analysisMode: "classic",
};

async function getSettings(req, res, next) {
  try {
    const installId = req.installId;

    let settings = await UserSettings.findOne({ installId }).lean();

    if (!settings) {
      settings = await UserSettings.create({ installId, ...DEFAULT_SETTINGS });
      settings = settings.toObject();
    }

    return res.status(200).json({
      success: true,
      data: {
        installId,
        highlightEnabled: settings.highlightEnabled,
        theme: settings.theme,
        scoreThreshold: settings.scoreThreshold,
        analysisMode: settings.analysisMode,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const installId = req.installId;
    const updates = {};

    if (typeof req.body.highlightEnabled === "boolean") {
      updates.highlightEnabled = req.body.highlightEnabled;
    }

    if (typeof req.body.theme === "string") {
      updates.theme = req.body.theme;
    }

    if (typeof req.body.scoreThreshold === "number") {
      updates.scoreThreshold = req.body.scoreThreshold;
    }

    if (typeof req.body.analysisMode === "string") {
      updates.analysisMode = req.body.analysisMode;
    }

    const settings = await UserSettings.findOneAndUpdate(
      { installId },
      { $set: updates },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

    return res.status(200).json({
      success: true,
      data: {
        installId,
        highlightEnabled: settings.highlightEnabled,
        theme: settings.theme,
        scoreThreshold: settings.scoreThreshold,
        analysisMode: settings.analysisMode,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSettings, updateSettings };
