import { Queue, QueueEvents } from "bullmq";
import { redisConnectionOptions } from "./redis.js";

export const LLM_QUEUE_NAME = "llm-autofill";

export type LlmJobData = {
  mode: "scoring" | "synthesis" | "select";
  userId: string;
  question: string;
  company?: string;
  role?: string;
  stories?: Array<{ id: string; title: string; content: string }>;
  story?: { title: string; content: string } | null;
  experiences?: Array<{ title: string; description: string }>;
  selectOptions?: string[];
  profileSummary?: string;
};

export type StoryScore = { storyId: string; score: number };

export type LlmJobResult = {
  mode: "scoring" | "synthesis" | "select";
  scores?: StoryScore[];
  answer?: string;
};

export const llmQueue = new Queue<LlmJobData, LlmJobResult>(LLM_QUEUE_NAME, {
  connection: redisConnectionOptions
});

export const llmQueueEvents = new QueueEvents(LLM_QUEUE_NAME, {
  connection: redisConnectionOptions
});
