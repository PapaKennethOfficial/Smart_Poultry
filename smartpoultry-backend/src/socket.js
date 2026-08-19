const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("./config/prisma");

let io;

/**
 * Realtime layer: driver location + order chat.
 *
 * SECURITY MODEL
 * Every REST route in this app is wrapped in requireAuth + requireRole. This
 * layer previously bypassed all of it: `origin: "*"`, no handshake auth, rooms
 * joinable by anyone who knew an order id, and a client-supplied `senderId`.
 * That meant any website could connect, watch a driver's live GPS, and post
 * chat messages as any user.
 *
 * Now:
 *   1. Connections require a valid JWT and are rejected otherwise.
 *   2. CORS is an explicit allow-list, not "*".
 *   3. Joining an order room requires being a party to that order — its
 *      customer, its assigned driver, or a manager/admin.
 *   4. Identity is ALWAYS taken from the verified token, never from the
 *      payload. A client cannot claim to be someone else.
 *   5. Location updates are accepted only from the order's assigned driver.
 */

// ─── CORS allow-list ──────────────────────────────────────────────────────────
// Dev defaults cover the admin (5173) and PWA (5174) Vite servers. Set
// SOCKET_ALLOWED_ORIGINS (comma-separated) in production.
function allowedOrigins() {
  const configured = (process.env.SOCKET_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length) return configured;

  const fallback = [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ].filter(Boolean);
  return [...new Set(fallback)];
}

// ─── Authorisation helpers ────────────────────────────────────────────────────

const STAFF_ROLES = new Set(["ADMIN", "MANAGER"]);

/**
 * May this user act on this order, and in what capacity?
 * Rooms are keyed by DeliveryOrder.id (the internal cuid), which is what every
 * client already sends.
 */
async function orderAccess(orderId, user) {
  if (!orderId || typeof orderId !== "string") return null;

  const order = await prisma.deliveryOrder.findUnique({
    where: { id: orderId },
    select: { id: true, orderId: true, customerId: true, driverId: true, status: true },
  });
  if (!order) return null;

  if (STAFF_ROLES.has(user.role)) return { order, as: "staff" };
  if (order.customerId === user.id) return { order, as: "customer" };
  if (order.driverId === user.id) return { order, as: "driver" };
  return null;
}

const room = (orderId) => `order:${orderId}`;

// ─── Init ─────────────────────────────────────────────────────────────────────

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Handshake authentication. Both frontends already send `auth: { token }`,
  // so this required no client change — the server simply never checked it.
  io.use(async (socket, next) => {
    try {
      const raw =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer /, "");

      if (!raw) return next(new Error("Authentication required"));
      if (!process.env.JWT_SECRET) return next(new Error("Server auth not configured"));

      const payload = jwt.verify(raw, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, role: true, name: true },
      });
      if (!user) return next(new Error("Account no longer exists"));

      socket.user = user;
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;

    // Personal room, so the server can notify a specific user directly.
    socket.join(`user:${user.id}`);

    // ── Join an order room ────────────────────────────────────────────────
    socket.on("join_order_room", async (orderId, ack) => {
      const access = await orderAccess(orderId, user);
      if (!access) {
        if (typeof ack === "function") ack({ ok: false, error: "Not permitted" });
        socket.emit("room_error", { orderId, error: "You do not have access to this order" });
        return;
      }
      socket.join(room(orderId));
      if (typeof ack === "function") ack({ ok: true, as: access.as });
    });

    socket.on("leave_order_room", (orderId) => {
      if (typeof orderId === "string") socket.leave(room(orderId));
    });

    // ── Driver location ───────────────────────────────────────────────────
    socket.on("location_update", async (data = {}) => {
      const { orderId, latitude, longitude } = data;

      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;

      const access = await orderAccess(orderId, user);
      // ONLY the assigned driver may report a position. A customer or an
      // outsider could previously spoof any driver's location.
      if (!access || access.as !== "driver") {
        socket.emit("room_error", { orderId, error: "Only the assigned driver can send location" });
        return;
      }

      // Privacy: a driver's position is only shared while the delivery is
      // actually in transit. The REST endpoint enforces the same rule; without
      // it here, a stale client could keep broadcasting a driver's whereabouts
      // after the job finished.
      if (access.order.status !== "IN_TRANSIT") return;

      // Emit both names: the server used to emit `location_updated` while the
      // clients listened for `location_update`, so live tracking never worked.
      const payload = { orderId, latitude: lat, longitude: lon, at: new Date().toISOString() };
      io.to(room(orderId)).emit("location_update", payload);
      io.to(room(orderId)).emit("location_updated", payload);

      // Persist, throttled — a geolocation watch fires far faster than this
      // needs to be written. `where` uses the internal id, matching the rooms;
      // the old code queried the human-readable orderId and always threw.
      const now = Date.now();
      if (!socket.lastLocationWrite || now - socket.lastLocationWrite > 10_000) {
        socket.lastLocationWrite = now;
        try {
          await prisma.deliveryOrder.update({
            where: { id: orderId },
            data: {
              driverLatitude: lat,
              driverLongitude: lon,
              driverLocationUpdatedAt: new Date(),
            },
          });
        } catch (err) {
          console.error("[socket] location persist failed:", err.message);
        }
      }
    });

    // ── Order chat ────────────────────────────────────────────────────────
    socket.on("send_message", async (data = {}) => {
      const { orderId } = data;
      const text = typeof data.message === "string" ? data.message.trim() : "";
      if (!text) return;
      if (text.length > 2000) return;

      const access = await orderAccess(orderId, user);
      if (!access) {
        socket.emit("room_error", { orderId, error: "You do not have access to this order" });
        return;
      }

      try {
        const saved = await prisma.deliveryMessage.create({
          data: {
            // DeliveryMessage.orderId references DeliveryOrder.id — the same
            // identifier the rooms use. The previous code left this ambiguous
            // in a TODO comment.
            orderId: access.order.id,
            // Identity comes from the verified token. The client used to send
            // senderId, which let anyone post as anyone.
            senderId: user.id,
            message: text,
          },
          include: { sender: { select: { id: true, name: true, role: true } } },
        });

        // Emit both names for the same reason as above: clients listen for
        // `chat_message`, the old server emitted `receive_message`.
        io.to(room(orderId)).emit("chat_message", saved);
        io.to(room(orderId)).emit("receive_message", saved);
      } catch (err) {
        console.error("[socket] message save failed:", err.message);
        socket.emit("room_error", { orderId, error: "Message could not be sent" });
      }
    });

    socket.on("disconnect", () => {
      // Nothing to clean up: rooms are torn down by socket.io automatically.
    });
  });

  console.log(`[socket] ready — origins: ${allowedOrigins().join(", ")}`);
};

const getIo = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

/**
 * Broadcast to everyone in an order's room. Safe to call from REST handlers:
 * if the socket layer is not up it logs and returns rather than throwing, so a
 * realtime failure can never break the HTTP request that triggered it.
 *
 * This is the bridge that was missing. Messages and locations were written by
 * REST endpoints and never announced, so the clients — which do listen — saw
 * nothing until a manual refresh.
 */
function emitToOrder(orderId, event, payload) {
  if (!io || !orderId) return;
  try {
    io.to(room(orderId)).emit(event, payload);
  } catch (err) {
    console.error("[socket] emit failed:", err.message);
  }
}

module.exports = { initSocket, getIo, emitToOrder };
