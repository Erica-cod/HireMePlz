import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __hiremeplzPrisma__: PrismaClient | undefined;
}

export const prisma =
  global.__hiremeplzPrisma__ ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  global.__hiremeplzPrisma__ = prisma;
}
