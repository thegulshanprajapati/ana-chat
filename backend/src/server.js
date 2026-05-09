import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import usersRoutes from "./routes/users.js";
import chatsRoutes from "./routes/chats.js";
import messagesRoutes from "./routes/messages.js";
import webhookRoutes from "./routes/webhooks.js";
import { requireUser } from "./middleware/auth.js";
import errorHandler from "./middleware/errorHandler.js";
import { connectDb } from "./db.js";
import { initSocket } from "./socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.set("trust proxy", 1);

const apiPrefix = "/api";
const clientOriginConfig = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "https://chat.myana.site,https://www.chat.myana.site";
const allowedOrigins = clientOriginConfig
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

console.log("[Server] Trusted proxy enabled. Allowed origins:", allowedOrigins);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/[^/]+$/.test(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
  })
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use(
  `${apiPrefix}/uploads`,
  express.static(path.join(__dirname, "uploads"), {
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
  })
);

app.get("/", (_req, res) => {
  res.redirect("/status");
});

app.get("/status", (_req, res) => {
  res.sendFile(path.join(__dirname, "status.html"));
});

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get(`${apiPrefix}/health`, (_req, res) => {
  res.json({ status: "ok" });
});

const authLimiter = (await import("express-rate-limit")).default({ windowMs: 5 * 60 * 1000, max: 40 });
app.use(`${apiPrefix}/auth`, authLimiter);

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/users`, usersRoutes);
app.use(`${apiPrefix}/chats`, chatsRoutes);
app.use(`${apiPrefix}/messages`, messagesRoutes);
app.use(`${apiPrefix}/webhooks`, webhookRoutes);
app.get(`${apiPrefix}/me`, requireUser, (req, res) => {
  res.json(req.user);
});

app.use(`${apiPrefix}/*`, (_req, res) => {
  res.status(404).json({ error: "Resource not found" });
});

app.use(errorHandler);

const basePort = Number(process.env.PORT || 5000);
const isLocalDev = process.env.NODE_ENV !== "production";
const maxPortAttempts = 10;

function startServer(port, attempts = 0) {
  const server = createServer(app);

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && isLocalDev && attempts < maxPortAttempts) {
      const nextPort = port + 1;
      console.warn(`[Server] Port ${port} is already in use. Trying ${nextPort} instead...`);
      startServer(nextPort, attempts + 1);
      return;
    }

    console.error("[Server] Startup failed:", error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`[Server] Listening on port ${port} - API base path: ${apiPrefix}`);
    console.log(`[Server] Health checks available at /healthz and ${apiPrefix}/health`);
  });

  initSocket(server)
    .then((io) => {
      app.set("io", io);
      console.log("[Socket.IO] Initialized successfully");
    })
    .catch((err) => {
      console.error("[Socket.IO] Initialization failed:", err.message);
    });
}

startServer(basePort);

connectDb()
  .then(() => {
    console.log("[Database] Connected successfully");
  })
  .catch((err) => {
    console.error("[Database] Connection failed (non-blocking):", err.message);
    console.error("[Database] Some features may not work until database connection is restored");
  });
