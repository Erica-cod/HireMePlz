import { env } from "./config/env.js";
import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`HireMePlz backend listening on http://localhost:${env.PORT}`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`Received ${signal}, shutting down backend...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log("Prisma disconnected. Bye.");
      process.exit(0);
    } catch (error) {
      console.error("Error during Prisma disconnect:", error);
      process.exit(1);
    }
  });
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
