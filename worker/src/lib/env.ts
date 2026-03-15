import { config } from "dotenv";

config({ path: "../.env" });
config();

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const workerEnv = {
  databaseUrl: process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  workerPollIntervalMs: parsePositiveInt(process.env.WORKER_POLL_INTERVAL_MS, 10 * 60 * 1000),
  jobspyFetchCommand: (process.env.JOBSPY_FETCH_COMMAND || "").trim(),
  jsearchApiKey: process.env.JSEARCH_API_KEY || "",
  adzunaAppId: process.env.ADZUNA_APP_ID || "",
  adzunaAppKey: process.env.ADZUNA_APP_KEY || ""
};
