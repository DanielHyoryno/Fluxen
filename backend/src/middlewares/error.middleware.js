const env = require("../config/env");
const { fail } = require("../utils/response");

function notFoundHandler(req, res) {
  return fail(res, "Route not found", 404, "ROUTE_NOT_FOUND");
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err?.type === "entity.parse.failed") {
    return fail(res, "Request body contains invalid JSON", 400, "INVALID_JSON");
  }

  if (err?.type === "entity.too.large") {
    return fail(res, "Request body is too large", 413, "PAYLOAD_TOO_LARGE");
  }

  const requestedStatus = Number(err?.statusCode || err?.status);
  const status = requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
  const errorCode = err?.errorCode || (status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
  const message = status === 500 && env.isProd ? "Internal server error" : err?.message || "Internal server error";

  console.error("Unhandled request error:", {
    method: req.method,
    path: req.originalUrl,
    error: err,
  });

  return fail(res, message, status, errorCode);
}

module.exports = { errorHandler, notFoundHandler };
