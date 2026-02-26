import dotenv from "dotenv";

dotenv.config();

export const env = {
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 5000),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  adminEmail: process.env.ADMIN_EMAIL || "admin@mail.com",
  adminPassword: process.env.ADMIN_PASSWORD || "1234",
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER || "root",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "icb",
};
