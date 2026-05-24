const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");

// Fields we ever return to the client (never the password hash).
const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  notificationPreferences: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

// ─── GET /users/me ───────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// ─── PUT /users/me ───────────────────────────────────────────────────────────
// Updates the logged-in user's own profile (name / email / phone).
// Role changes are intentionally NOT allowed here — that's an admin action.
const updateMe = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    // Email uniqueness check — only when email is actually changing.
    if (email) {
      const clash = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user.id } },
        select: { id: true },
      });
      if (clash) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const data = {};
    if (name !== undefined)  data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone; // allow nullable

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: USER_PUBLIC_SELECT,
    });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /users/me/notifications ───────────────────────────────────────────
// Merges the incoming preferences object into the stored JSON so the frontend
// can PATCH a single toggle without re-sending every key.
const updateNotifications = async (req, res, next) => {
  try {
    const incoming = req.body.preferences || {};

    const current = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { notificationPreferences: true },
    });
    if (!current) return res.status(404).json({ message: "User not found" });

    const merged = { ...(current.notificationPreferences || {}), ...incoming };

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { notificationPreferences: merged },
      select: USER_PUBLIC_SELECT,
    });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /users/me/password ────────────────────────────────────────────────
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, password: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    res.status(200).json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
};

// ─── GET /users ──────────────────────────────────────────────────────────────
// ADMIN / MANAGER only (enforced by roleGuard in the route).
const listUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: USER_PUBLIC_SELECT,
    });
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  updateMe,
  updateNotifications,
  updatePassword,
  listUsers,
};
