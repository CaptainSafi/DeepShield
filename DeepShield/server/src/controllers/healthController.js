function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: "Backend is healthy",
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
