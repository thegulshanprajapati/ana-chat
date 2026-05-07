import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import usersRoutes from "./routes/users.js";
import chatsRoutes from "./routes/chats.js";
import messagesRoutes from "./routes/messages.js";
import webhookRoutes from "./routes/webhooks.js";
import { requireUser } from "./middleware/auth.js";
import { initSocket } from "./socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const server = createServer(app);

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // In local development, allow any HTTP(S) origin to avoid LAN/IP mismatch friction.
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/[^/]+$/.test(origin)) return true;
  return false;
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error("CORS blocked"));
  },
  credentials: true
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Required for OAuth popup postMessage flows (e.g. Google Identity Services).
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders(res) {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));

const authLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 40 });
app.use("/auth", authLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.get("/me", requireUser, (req, res) => {
  res.json(req.user);
});

app.use("/admin", adminRoutes);
app.use("/users", usersRoutes);
app.use("/chats", chatsRoutes);
app.use("/chat", chatsRoutes); // backward compatibility
app.use("/messages", messagesRoutes);
app.use("/webhooks", webhookRoutes);

const io = initSocket(server);
app.set("io", io);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ message: "Internal server error" });
});

const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, () => {
  console.log(`API running on ${PORT}`);
});
