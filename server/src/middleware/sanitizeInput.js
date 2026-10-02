function sanitizeValue(value) {
  if (typeof value === "string") {
    return value
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[<>]/g, "")
      .trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    const sanitized = {};
    Object.keys(value).forEach((key) => {
      sanitized[key] = sanitizeValue(value[key]);
    });
    return sanitized;
  }

  return value;
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
}

module.exports = { sanitizeInput };
