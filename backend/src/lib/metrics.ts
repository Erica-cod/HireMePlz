import type { NextFunction, Request, Response } from "express";
import client from "prom-client";

const registry = new client.Registry();
client.collectDefaultMetrics({
  register: registry,
  prefix: "hiremeplz_backend_"
});

const httpRequestsTotal = new client.Counter({
  name: "hiremeplz_http_requests_total",
  help: "Total HTTP requests handled by backend",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry]
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "hiremeplz_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry]
});

function getRouteLabel(request: Request) {
  if (request.route?.path && typeof request.route.path === "string") {
    return request.route.path;
  }
  if (request.baseUrl && request.path) {
    return `${request.baseUrl}${request.path}`;
  }
  return request.path || "unknown";
}

export function metricsMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const end = httpRequestDurationSeconds.startTimer();
  response.on("finish", () => {
    const labels = {
      method: request.method,
      route: getRouteLabel(request),
      status_code: String(response.statusCode)
    };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
}

export async function metricsHandler(_request: Request, response: Response) {
  response.setHeader("Content-Type", registry.contentType);
  response.send(await registry.metrics());
}
