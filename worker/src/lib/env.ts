import { config } from "dotenv";

config({ path: "../.env" });
config();

export const workerEnv = {
  databaseUrl: process.env.DATABASE_URL || "",
  jsearchApiKey: process.env.JSEARCH_API_KEY || "",
  adzunaAppId: process.env.ADZUNA_APP_ID || "",
  adzunaAppKey: process.env.ADZUNA_APP_KEY || ""
};
