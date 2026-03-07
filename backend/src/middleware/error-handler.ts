import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const requestId = String(response.locals.requestId ?? response.getHeader("X-Request-Id") ?? "n/a");

  if (error instanceof ZodError) {
    console.warn(
      `[${requestId}] Validation failed ${request.method} ${request.originalUrl}`,
      error.issues
    );
    response.status(400).json({
      message: "Invalid request payload",
      issues: error.issues
    });
    return;
  }

  const message =
    error instanceof Error ? error.message : "An unknown internal server error occurred";

  console.error(`[${requestId}] Unhandled error ${request.method} ${request.originalUrl}`, error);

  response.status(500).json({
    message,
    error: process.env.NODE_ENV === "production" ? undefined : error
  });
}
