import { config } from "dotenv";
import { readFileSync } from "node:fs";

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

export const workerEnv = {
  databaseUrl: readSecret("DATABASE_URL"),
  jsearchApiKey: readSecret("JSEARCH_API_KEY"),
  adzunaAppId: readSecret("ADZUNA_APP_ID"),
  adzunaAppKey: readSecret("ADZUNA_APP_KEY"),
  sendgridApiKey: readSecret("SENDGRID_API_KEY"),
  sendgridFromEmail: readSecret("SENDGRID_FROM_EMAIL"),
  jobAlertMinScore: Number(process.env.JOB_ALERT_MIN_SCORE || "0.75")
};
