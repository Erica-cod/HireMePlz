import { Queue, QueueEvents } from "bullmq";
import { redisConnectionOptions } from "./redis.js";

export const LLM_QUEUE_NAME = "llm-autofill";

export type LlmJobData = {
  userId: string;
  question: string;
  company?: string;
  role?: string;
  story: {
    title: string;
    content: string;
  } | null;
  experiences: Array<{ title: string; description: string }>;
  selectOptions?: string[];
  profileSummary?: string;
};

export type LlmJobResult = {
  answer: string;
};

export const llmQueue = new Queue<LlmJobData, LlmJobResult>(LLM_QUEUE_NAME, {
  connection: redisConnectionOptions
});

export const llmQueueEvents = new QueueEvents(LLM_QUEUE_NAME, {
  connection: redisConnectionOptions
});
