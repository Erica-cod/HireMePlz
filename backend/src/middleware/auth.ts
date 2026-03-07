import type { NextFunction, Request, Response } from "express";

import { verifyToken } from "../lib/security.js";

export type AuthenticatedRequest = Request & {
  userId?: string;
};

export function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json({ message: "Missing authentication token" });
    return;
  }

  try {
    const token = authorization.replace("Bearer ", "");
    const payload = verifyToken(token);
    request.userId = payload.userId;
    next();
  } catch {
    response.status(401).json({ message: "Invalid login state, please sign in again" });
  }
}
