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
import http from "http";
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

// ===== CRITICAL FIX 1: Create HTTP server (not app.listen) =====
let httpServer = null;

const apiPrefix = "/api";
const clientOriginConfig = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "https://chat.myana.site,https://www.chat.myana.site,https://api.chat.myana.site,http://localhost:3000,http://localhost:5173";
const allowedOrigins = clientOriginConfig
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function originAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/[^/]+$/.test(origin)) return true;
  return false;
}

console.log("[Server] Trusted proxy enabled. Allowed origins:", allowedOrigins);

const allowedCorsHeaders = [
  "Content-Type",
  "Authorization",
  "x-device-fingerprint",
  "X-Requested-With",
  "Accept",
  "Origin"
];

const corsOptions = {
  origin(origin, callback) {
    if (originAllowed(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: allowedCorsHeaders,
  exposedHeaders: ["Authorization"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin || "";
  if (originAllowed(requestOrigin)) {
    res.header("Access-Control-Allow-Origin", requestOrigin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", allowedCorsHeaders.join(", "));
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Vary", "Origin");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});
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

app.get("/status-script.js", (_req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "status-script.js"));
});

app.get("/status", (_req, res) => {
  res.sendFile(path.join(__dirname, "status.html"));
});

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health", async (req, res) => {
  const serverStatus = "ok";
  let databaseStatus = "unknown";
  let socketStatus = "disconnected";
  let dbError = null;

  try {
    await connectDb();
    databaseStatus = "connected";
  } catch (error) {
    databaseStatus = "disconnected";
    dbError = error.message;
  }

  const io = req.app.get("io");
  if (io && io.engine) {
    socketStatus = io.engine.clientsCount !== undefined ? "running" : "running";
  }

  return res.json({
    server: serverStatus,
    database: databaseStatus,
    socket: socketStatus,
    timestamp: new Date().toISOString(),
    ...(dbError ? { databaseError: dbError } : {})
  });
});

app.get("/db-health", async (_req, res) => {
  try {
    const db = await connectDb();
    const pingResult = await db.admin().ping();
    return res.json({ status: "ok", db: pingResult });
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
});

app.get(`${apiPrefix}/health`, (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/auth/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/socket-status", (req, res) => {
  const io = req.app.get("io");
  if (!io) {
    return res.json({ status: "disconnected", activeConnections: 0 });
  }
  
  const activeConnections = io.sockets?.sockets?.size || 0;
  res.json({ 
    // If Socket.IO is initialized, the server is "connected"/healthy even with 0 clients.
    // The status page should only show red when Socket.IO is not initialized.
    status: "connected",
    activeConnections 
  });
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

// ===== CRITICAL FIX 2: Proper server startup with Socket.IO =====
function startServer(port, attempts = 0) {
  // Create HTTP server (required for Socket.IO)
  httpServer = http.createServer(app);

  // ===== CRITICAL FIX 3: Handle server errors properly =====
  httpServer.on("error", (error) => {
    if (error.code === "EADDRINUSE" && isLocalDev && attempts < maxPortAttempts) {
      const nextPort = port + 1;
      console.warn(`[Server] Port ${port} is already in use. Trying ${nextPort} instead...`);
      httpServer.close();
      startServer(nextPort, attempts + 1);
      return;
    }

    console.error("[Server] Startup failed:", error);
    process.exit(1);
  });

  const listenHost = "0.0.0.0";
  
  // ===== CRITICAL FIX 4: server.listen() instead of app.listen() =====
  httpServer.listen(port, listenHost, () => {
    console.log(`[Server] ✓ HTTP Server listening on ${listenHost}:${port}`);
    console.log(`[Server] API base path: ${apiPrefix}`);
  });

  // ===== CRITICAL FIX 5: Initialize Socket.IO on HTTP server =====
  initSocket(httpServer)
    .then((io) => {
      app.set("io", io);
      httpServer.io = io; // Store io on server for monitoring
      console.log("[Socket.IO] ✓ Initialized successfully");
      console.log("[Socket.IO] Transports: websocket (primary), polling (fallback)");
      console.log("[Socket.IO] CORS origins configured: ", allowedOrigins.join(", "));
    })
    .catch((err) => {
      console.error("[Socket.IO] ✗ Initialization failed:", err.message);
      process.exit(1);
    });
}

async function boot() {
  console.log("[Startup] NODE_ENV=", process.env.NODE_ENV);
  console.log("[Startup] PORT=", basePort);
  console.log("[Startup] Database connecting...");

  try {
    await connectDb();
    console.log("[Database] ✓ Connected successfully");
  } catch (err) {
    console.error("[Database] ✗ Connection failed:", err.message);
    process.exit(1);
  }

  startServer(basePort);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[Shutdown] SIGTERM received, shutting down gracefully...");
  if (httpServer) {
    httpServer.close(() => {
      console.log("[Shutdown] HTTP server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on("SIGINT", () => {
  console.log("[Shutdown] SIGINT received, shutting down gracefully...");
  if (httpServer) {
    httpServer.close(() => {
      console.log("[Shutdown] HTTP server closed");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

boot();
