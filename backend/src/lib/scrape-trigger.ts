import { Queue } from "bullmq";
import { redisConnectionOptions } from "./redis.js";

export const SCRAPE_TRIGGER_QUEUE = "scrape-trigger";

export type ScrapeTriggerData = {
  subscriptionId: string;
  userId: string;
};

export const scrapeTriggerQueue = new Queue<ScrapeTriggerData>(
  SCRAPE_TRIGGER_QUEUE,
  { connection: redisConnectionOptions }
);
