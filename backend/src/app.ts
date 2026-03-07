import cors from "cors";
import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(
  cors({
    origin: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiRouter);
app.use(errorHandler);
