import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import authRouter from "./routes/auth.routes.js";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Маршрут не найден." });
});

export default app;

