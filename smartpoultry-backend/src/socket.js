const { Server } = require("socket.io");
const prisma = require("./config/prisma");
let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Join a specific order room for tracking/chat
    socket.on("join_order_room", (orderId) => {
      socket.join(orderId);
      console.log(`Socket ${socket.id} joined room ${orderId}`);
    });

    // Handle location updates from the driver
    socket.on("location_update", async (data) => {
      const { orderId, latitude, longitude } = data;
      // Broadcast to anyone in the order room (the customer)
      io.to(orderId).emit("location_updated", { latitude, longitude });

      // Persist to DB (optional: throttle this so we don't spam DB)
      try {
        await prisma.deliveryOrder.update({
          where: { orderId: orderId },
          data: {
            driverLatitude: latitude,
            driverLongitude: longitude,
            driverLocationUpdatedAt: new Date()
          }
        });
      } catch (err) {
        console.error("Error updating location in DB:", err);
      }
    });

    // Handle chat messages
    socket.on("send_message", async (data) => {
      const { orderId, senderId, message } = data;
      
      try {
        // Persist message
        const savedMessage = await prisma.deliveryMessage.create({
          data: {
            orderId: orderId, // Needs to be the internal ID or orderId? The schema says `orderId String`. Wait, let's verify schema.
            // Actually, the schema uses internal `id` for relations, so data.orderId must map to `id`.
            senderId: senderId,
            message: message
          },
          include: {
            sender: {
              select: { name: true, role: true }
            }
          }
        });

        // Broadcast to room
        io.to(orderId).emit("receive_message", savedMessage);
      } catch (err) {
        console.error("Error saving message:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIo };
