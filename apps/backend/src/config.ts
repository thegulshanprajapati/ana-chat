import dotenv from "dotenv";
dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

export const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI || process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "",
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
  cookieDomain: process.env.COOKIE_DOMAIN || "",
  cookieSecure: process.env.NODE_ENV === "production",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  storageBucket: process.env.STORAGE_BUCKET || "",
  backupRetentionHours: 24,
  offlineMessageTtlSeconds: 24 * 60 * 60
};
