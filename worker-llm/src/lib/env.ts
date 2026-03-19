import { config } from "dotenv";

config({ path: "../.env" });
config();

export const llmEnv = {
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || undefined,
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  concurrency: Number(process.env.LLM_WORKER_CONCURRENCY) || 5,
  storyBatchSize: Number(process.env.STORY_BATCH_SIZE) || 10
};
