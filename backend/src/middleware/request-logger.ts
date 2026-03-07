import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "X-Request-Id";
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{1,100}$/;

function resolveRequestId(request: Request) {
  const incoming = request.header(REQUEST_ID_HEADER);
  if (incoming && VALID_REQUEST_ID.test(incoming)) {
    return incoming;
  }

  return randomUUID();
}

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const requestId = resolveRequestId(request);
  const startedAt = Date.now();

  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.locals.requestId = requestId;

  response.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.info(
      `[${requestId}] ${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`
    );
  });

  next();
}
