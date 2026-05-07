export default function errorHandler(err, req, res, next) {
  console.error("[API Error]", err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: err.message || "Internal server error"
  });
}
