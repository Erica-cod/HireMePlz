import type { NextFunction, Request, Response } from "express";
import {
  httpRequestDuration,
  httpRequestsTotal,
  httpRequestsInFlight,
  httpRequestSizeBytes,
  httpResponseSizeBytes
} from "../lib/metrics.js";

/**
 * 将 Express 路径标准化为 Prometheus label 友好的格式，
 * 避免高基数问题（把具体的 ID 替换为 :id）
 */
function normalizeRoute(req: Request): string {
  if (req.route?.path) {
    return req.baseUrl + req.route.path;
  }
  const path = req.originalUrl.split("?")[0];
  return path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "/:id"
  ).replace(/\/\d+/g, "/:id");
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/metrics") {
    next();
    return;
  }

  const end = httpRequestDuration.startTimer();
  httpRequestsInFlight.inc();

  const reqSize = parseInt(req.headers["content-length"] ?? "0", 10);

  res.on("finish", () => {
    const route = normalizeRoute(req);
    const method = req.method;
    const statusCode = String(res.statusCode);

    end({ method, route, status_code: statusCode });
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestsInFlight.dec();

    if (reqSize > 0) {
      httpRequestSizeBytes.observe({ method, route }, reqSize);
    }

    const resSize = parseInt(res.getHeader("content-length") as string, 10);
    if (resSize > 0) {
      httpResponseSizeBytes.observe({ method, route }, resSize);
    }
  });

  next();
}
