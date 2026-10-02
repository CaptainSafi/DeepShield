function requireInstallId(req, res, next) {
  const installId = req.header("x-install-id");

  if (!installId) {
    return res.status(400).json({
      success: false,
      message: "Missing x-install-id header",
    });
  }

  req.installId = installId.trim();
  return next();
}

module.exports = { requireInstallId };
