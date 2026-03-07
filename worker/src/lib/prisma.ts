import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

if (!process.env.DATABASE_URL && process.env.DATABASE_URL_FILE) {
  try {
    process.env.DATABASE_URL = readFileSync(
      process.env.DATABASE_URL_FILE,
      "utf8"
    ).trim();
  } catch {
    // Keep default behavior. Prisma will throw if DATABASE_URL remains missing.
  }
}

export const prisma = new PrismaClient({
  log: ["error", "warn"]
});
