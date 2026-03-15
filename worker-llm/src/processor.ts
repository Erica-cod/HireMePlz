import { Job } from "bullmq";
import { OpenAI } from "openai";
import { llmEnv } from "./lib/env.js";

export type LlmJobData = {
  userId: string;
  question: string;
  company?: string;
  role?: string;
  story: {
    title: string;
    situation: string;
    task: string | null;
    action: string;
    result: string;
  } | null;
  experiences: Array<{ title: string; description: string }>;
};

export type LlmJobResult = {
  answer: string;
};

const openai = llmEnv.openaiApiKey
  ? new OpenAI({
      apiKey: llmEnv.openaiApiKey,
      ...(llmEnv.openaiBaseUrl && { baseURL: llmEnv.openaiBaseUrl }),
    })
  : null;

function buildFallbackAnswer(
  question: string,
  company: string | undefined,
  role: string | undefined,
  story: LlmJobData["story"],
  experiences: LlmJobData["experiences"]
) {
  if (story) {
    return [
      `For "${question}", I would answer using my ${story.title} experience.`,
      `Situation: ${story.situation}`,
      story.task ? `Task: ${story.task}` : "",
      `Action: ${story.action}`,
      `Result: ${story.result}`,
      company || role
        ? `This experience is highly relevant to the ${role || "position"} at ${company || "your company"}.`
        : "This experience demonstrates practical problem-solving and continuous learning."
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (experiences[0]) {
    return `${experiences[0].title} is my most relevant experience. In this role, I worked on ${experiences[0].description} and gained hands-on experience related to this question.`;
  }

  return "I can further answer this question by combining details from my projects and internship experience.";
}

export async function processAutofillJob(
  job: Job<LlmJobData, LlmJobResult>
): Promise<LlmJobResult> {
  const { company, experiences, question, role, story } = job.data;

  if (!openai) {
    console.log(`[worker-llm] No OpenAI key, using fallback for job ${job.id}`);
    return { answer: buildFallbackAnswer(question, company, role, story, experiences) };
  }

  const prompt = [
    `Role: ${role || "Not provided"}`,
    `Company: ${company || "Not provided"}`,
    `Question: ${question}`,
    `Story title: ${story?.title || "Not provided"}`,
    `Situation: ${story?.situation || "Not provided"}`,
    `Task: ${story?.task || "Not provided"}`,
    `Action: ${story?.action || "Not provided"}`,
    `Result: ${story?.result || "Not provided"}`
  ].join("\n");

  console.log(`[worker-llm] Calling LLM for job ${job.id}`);

  const completion = await openai.chat.completions.create({
    model: llmEnv.openaiModel,
    messages: [
      { role: "system", content: "You are a job application assistant. Generate an English answer suitable for a software engineering application form using the user's experience details. Requirements: natural, specific, not exaggerated, and around 120 to 180 words." },
      { role: "user", content: prompt },
    ],
  });

  const answer = (completion.choices[0]?.message?.content ?? "").trim();
  console.log(`[worker-llm] LLM returned ${answer.length} chars for job ${job.id}`);

  return { answer };
}
