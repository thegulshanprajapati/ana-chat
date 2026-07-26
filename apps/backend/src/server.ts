import http from "http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import "express-async-errors";
import { connectDatabase } from "./db.js";
import { config } from "./config.js";
import { createSocketServer } from "./socket/index.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import healthRoutes from "./routes/health.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:3000"],
  credentials: true
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/health", healthRoutes);

app.use(errorHandler);

async function start() {
  try {
    await connectDatabase();
    createSocketServer(server);
    server.listen(config.port, () => {
      console.log(`[Backend] HTTP server listening on port ${config.port}`);
    });
  } catch (error) {
    console.error("[Backend] Startup failure:", error);
    process.exit(1);
  }
}

start();
