import cors from "cors";
import express from "express";

import { metricsHandler, metricsMiddleware } from "./lib/metrics.js";
import { errorHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(
  cors({
    origin: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(metricsMiddleware);
app.get("/metrics", metricsHandler);
app.use("/api", apiRouter);
app.use(errorHandler);
