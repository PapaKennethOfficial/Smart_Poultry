const jwt = require("jsonwebtoken");

/**
 * authenticate — JWT Bearer token middleware
 *
 * Usage:
 *   const authenticate = require("../middleware/auth");
 *   router.get("/protected", authenticate, handler);
 *
 * On success  → attaches req.user = { id, role } and calls next()
 * On failure  → responds 401 { error: "Unauthorized" }
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "Authentication is not configured" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const prisma = require("../config/prisma");
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true }
    });
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: account no longer exists" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  }
}

module.exports = { requireAuth, requireRole, authenticate: requireAuth };
