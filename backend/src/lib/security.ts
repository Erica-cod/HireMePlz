import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

const TOKEN_EXPIRES_IN = "7d";

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(userId: string) {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as { userId: string };
}
