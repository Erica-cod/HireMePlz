import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { z } from "zod";

config({ path: "../.env" });
config();

function readSecret(name: string) {
  const direct = process.env[name];
  if (direct && direct.trim()) {
    return direct.trim();
  }

  const filePath = process.env[`${name}_FILE`];
  if (!filePath) {
    return "";
  }

  try {
    return readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8).default("hiremeplz-dev-secret"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  PORT: z.coerce.number().default(4000)
});

export const env = envSchema.parse({
  ...process.env,
  DATABASE_URL: readSecret("DATABASE_URL"),
  JWT_SECRET: readSecret("JWT_SECRET"),
  OPENAI_API_KEY: readSecret("OPENAI_API_KEY"),
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  PORT: process.env.PORT
});
