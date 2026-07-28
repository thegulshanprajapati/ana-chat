import express from "express";
import { startWhatsAppSession, getWhatsAppSession, disconnectWhatsAppSession } from "../services/bot.js";
import { requireUser } from "../middleware/auth.js";

const router = express.Router();

router.get("/status", requireUser, async (req, res) => {
  const userId = req.user.id;
  const session = getWhatsAppSession(userId);
  if (!session) {
    return res.json({ status: "disconnected", qr: null });
  }
  return res.json({ status: session.status, qr: session.qr });
});

router.post("/connect", requireUser, async (req, res) => {
  const userId = req.user.id;
  const io = req.app.get("io");

  try {
    startWhatsAppSession(
      userId,
      (qr) => {
        if (io) {
          io.to(`user_${userId}`).emit("whatsapp_qr", { qr });
        }
      },
      (connState) => {
        if (io) {
          io.to(`user_${userId}`).emit("whatsapp_status", connState);
        }
      }
    );
    res.json({ success: true, message: "Connection starting..." });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to start WhatsApp connection" });
  }
});

router.post("/disconnect", requireUser, async (req, res) => {
  const userId = req.user.id;
  const io = req.app.get("io");

  try {
    await disconnectWhatsAppSession(userId);
    if (io) {
      io.to(`user_${userId}`).emit("whatsapp_status", { status: "disconnected" });
    }
    res.json({ success: true, message: "Disconnected successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to disconnect" });
  }
});

export default router;
