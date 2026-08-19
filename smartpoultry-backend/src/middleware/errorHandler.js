/**
 * errorHandler — Global Express error-handling middleware
 *
 * Must be registered LAST in app.js (after all routes) so that errors
 * forwarded via next(err) from any route or middleware reach it.
 *
 * Usage in route/controller:
 *   try {
 *     ...
 *   } catch (err) {
 *     next(err);   // forwards to this handler
 *   }
 *
 * Or with async routes using express-async-errors / Express 5 (auto-caught).
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log full error server-side for debugging; never send stack to client
  console.error(`[ERROR] ${req.method} ${req.path} →`, err);

  // Respect status codes set upstream (e.g. err.status = 404), else 500
  const status = typeof err.status === "number" ? err.status : 500;

  // Safe client message: use err.message only when the error was intentional
  // (status < 500). Internal errors get a generic message to avoid leaking details.
  const message =
    status < 500
      ? (err.message || "An error occurred")
      : "Internal server error";

  // Emit BOTH keys. The rest of the API answers with `message`, this handler
  // historically answered with `error`, and clients that only read one saw an
  // empty body and fell back to a generic axios string — which is how a real
  // 400 showed up on screen as "Request failed with status code 400".
  res.status(status).json({ error: message, message });
}

module.exports = errorHandler;
