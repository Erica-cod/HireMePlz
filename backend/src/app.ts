import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import { metricsMiddleware } from "./middleware/metrics.js";
import { requestLogger } from "./middleware/request-logger.js";
import { register } from "./lib/metrics.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(
  cors({
    origin: true,
    exposedHeaders: ["X-Request-Id"]
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(metricsMiddleware);
app.use(requestLogger);

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/api", apiRouter);
app.use(errorHandler);
