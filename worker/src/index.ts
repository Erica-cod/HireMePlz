import { prisma } from "./lib/prisma.js";
import { workerEnv } from "./lib/env.js";
import { processDueJobSubscriptions } from "./jobs/fetchJobs.js";

const POLL_INTERVAL_MS = workerEnv.workerPollIntervalMs;

async function runOnce() {
  const summary = await processDueJobSubscriptions();
  console.log(
    `[worker] Completed polling round: processed=${summary.processedSubscriptions}, success=${summary.successCount}, failed=${summary.failureCount}`
  );
}

async function main() {
  console.log(`[worker] Starting job ingestion worker. pollIntervalMs=${POLL_INTERVAL_MS}`);
  await runOnce();
  setInterval(() => {
    void runOnce().catch((error) => {
      console.error("[worker] Scheduled task failed", error);
    });
  }, POLL_INTERVAL_MS);
}

void main().catch(async (error) => {
  console.error("[worker] Startup failed", error);
  await prisma.$disconnect();
  process.exit(1);
});
