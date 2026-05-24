/**
 * authorize — Role-based access control middleware (RBAC)
 *
 * Usage:
 *   const authenticate = require("./auth");
 *   const authorize = require("./role");
 *   router.get("/protected-route", authenticate, authorize(["ADMIN", "MANAGER"]), handler);
 *
 * On success → continues execution with next()
 * On mismatch → responds with 403 { error: "Forbidden: Access denied" }
 */
function authorize(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }

    next();
  };
}

module.exports = authorize;
