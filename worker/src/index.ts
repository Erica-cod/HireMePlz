import { Worker } from "bullmq";

import { prisma } from "./lib/prisma.js";
import { workerEnv } from "./lib/env.js";
import { redisConnectionOptions } from "./lib/redis.js";
import { processDueJobSubscriptions, processSubscription } from "./jobs/fetchJobs.js";

const POLL_INTERVAL_MS = workerEnv.workerPollIntervalMs;
const SCRAPE_TRIGGER_QUEUE = "scrape-trigger";

async function runOnce() {
  const summary = await processDueJobSubscriptions();
  console.log(
    `[worker] Completed polling round: processed=${summary.processedSubscriptions}, success=${summary.successCount}, failed=${summary.failureCount}`
  );
}

const triggerWorker = new Worker(
  SCRAPE_TRIGGER_QUEUE,
  async (job) => {
    const { subscriptionId } = job.data as { subscriptionId: string; userId: string };
    console.log(`[worker] Received scrape trigger for subscription ${subscriptionId}`);

    const subscription = await prisma.jobSubscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription || !subscription.enabled) {
      console.log(`[worker] Subscription ${subscriptionId} not found or disabled, skipping`);
      return;
    }

    const result = await processSubscription(subscription);
    console.log(
      `[worker] Trigger scrape done for ${subscriptionId}: fetched=${result.fetchedCount}, inserted=${result.insertedCount}, matched=${result.matchedCount}`
    );
  },
  { connection: redisConnectionOptions, concurrency: 1 }
);

triggerWorker.on("failed", (job, err) => {
  console.error(`[worker] Trigger job ${job?.id} failed:`, err.message);
});

async function main() {
  console.log(
    `[worker] Starting job ingestion worker. pollIntervalMs=${POLL_INTERVAL_MS}, trigger queue enabled`
  );
  await runOnce();
  setInterval(() => {
    void runOnce().catch((error) => {
      console.error("[worker] Scheduled task failed", error);
    });
  }, POLL_INTERVAL_MS);
}

async function shutdown(signal: string) {
  console.log(`[worker] Received ${signal}, shutting down...`);
  await triggerWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

void main().catch(async (error) => {
  console.error("[worker] Startup failed", error);
  await prisma.$disconnect();
  process.exit(1);
});
