import { Worker } from "bullmq";
import { redisConnectionOptions } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";
import { llmEnv } from "./lib/env.js";
import { processAutofillJob } from "./processor.js";
import type { LlmJobData, LlmJobResult } from "./processor.js";

const LLM_QUEUE_NAME = "llm-autofill";

const worker = new Worker<LlmJobData, LlmJobResult>(
  LLM_QUEUE_NAME,
  async (job) => processAutofillJob(job),
  {
    connection: redisConnectionOptions,
    concurrency: llmEnv.concurrency
  }
);

worker.on("completed", (job) => {
  console.log(`[worker-llm] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker-llm] Job ${job?.id} failed:`, err.message);
});

console.log(
  `[worker-llm] Started. concurrency=${llmEnv.concurrency}, openai=${llmEnv.openaiApiKey ? "configured" : "fallback-mode"}`
);

async function shutdown(signal: string) {
  console.log(`[worker-llm] Received ${signal}, shutting down...`);
  await worker.close();
  await prisma.$disconnect();
  console.log("[worker-llm] Shutdown complete.");
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
