import { config } from "dotenv";
import { z } from "zod";

config({ path: "../.env" });
config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8).default("hiremeplz-dev-secret"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  PORT: z.coerce.number().default(4000),
  LLM_JOB_TIMEOUT_MS: z.coerce.number().default(30_000)
});

export const env = envSchema.parse(process.env);
