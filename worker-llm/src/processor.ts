import { Job } from "bullmq";
import { OpenAI } from "openai";
import { llmEnv } from "./lib/env.js";

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

const openai = llmEnv.openaiApiKey
  ? new OpenAI({
      apiKey: llmEnv.openaiApiKey,
      ...(llmEnv.openaiBaseUrl && { baseURL: llmEnv.openaiBaseUrl }),
    })
  : null;

function scoreFallback(
  question: string,
  stories: Array<{ id: string; title: string; content: string }>
): StoryScore[] {
  const qWords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  return stories.map((story) => {
    const text = `${story.title} ${story.content}`.toLowerCase();
    let hits = 0;
    for (const word of qWords) {
      if (text.includes(word)) hits++;
    }
    const score = qWords.length > 0 ? hits / qWords.length : 0;
    return { storyId: story.id, score: Math.min(score, 1) };
  });
}

async function scoreBatch(
  question: string,
  stories: Array<{ id: string; title: string; content: string }>,
  company: string | undefined,
  role: string | undefined
): Promise<StoryScore[]> {
  if (!openai) return scoreFallback(question, stories);

  const storiesList = stories
    .map((s, i) => `[Story ${i + 1}] id="${s.id}"\nTitle: ${s.title}\nContent: ${s.content}`)
    .join("\n\n");

  const prompt = [
    `Question from a job application: ${question}`,
    company ? `Company: ${company}` : null,
    role ? `Role: ${role}` : null,
    "",
    "Here are the candidate's stories:",
    "",
    storiesList,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: llmEnv.openaiModel,
    messages: [
      {
        role: "system",
        content: [
          "You are a relevance scorer. Given a job application question and a list of candidate stories,",
          "score each story's relevance to the question on a scale of 0 to 1.",
          "0 means completely irrelevant, 1 means a perfect match.",
          "Return ONLY a JSON array: [{\"storyId\": \"<id>\", \"score\": <number>}].",
          "No explanation, no markdown fences, just the raw JSON array.",
        ].join(" "),
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
  });

  const raw = (completion.choices[0]?.message?.content ?? "").trim();
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
    return parsed.map((item: { storyId: string; score: number }) => ({
      storyId: String(item.storyId),
      score: Math.max(0, Math.min(1, Number(item.score) || 0)),
    }));
  } catch (err) {
    console.error(`[worker-llm] Failed to parse scoring JSON: ${cleaned}`, err);
    return scoreFallback(question, stories);
  }
}

async function processScoringJob(
  job: Job<LlmJobData, LlmJobResult>
): Promise<LlmJobResult> {
  const { question, stories, company, role } = job.data;

  if (!stories || stories.length === 0) {
    console.log(`[worker-llm] No stories to score for job ${job.id}`);
    return { mode: "scoring", scores: [] };
  }

  const batchSize = llmEnv.storyBatchSize;
  if (stories.length <= batchSize) {
    console.log(`[worker-llm] Scoring ${stories.length} stories for job ${job.id}`);
    const scores = await scoreBatch(question, stories, company, role);
    return { mode: "scoring", scores };
  }

  console.log(`[worker-llm] Scoring ${stories.length} stories in batches of ${batchSize} for job ${job.id}`);
  const allScores: StoryScore[] = [];
  for (let i = 0; i < stories.length; i += batchSize) {
    const batch = stories.slice(i, i + batchSize);
    const batchScores = await scoreBatch(question, batch, company, role);
    allScores.push(...batchScores);
  }

  return { mode: "scoring", scores: allScores };
}

function buildSelectFallbackAnswer(
  question: string,
  options: string[],
  profileSummary: string,
  experiences: Array<{ title: string; description: string }>
): string {
  const q = question.toLowerCase();
  const totalYears = experiences.length > 0 ? Math.max(1, experiences.length) : 0;

  if (q.includes("experience") && (q.includes("year") || q.includes("total"))) {
    const sorted = options
      .map((o) => ({ text: o, nums: o.match(/(\d+)/g)?.map(Number) || [] }))
      .filter((o) => o.nums.length > 0)
      .sort((a, b) => {
        const aAvg = a.nums.reduce((s, n) => s + n, 0) / a.nums.length;
        const bAvg = b.nums.reduce((s, n) => s + n, 0) / b.nums.length;
        return Math.abs(aAvg - totalYears) - Math.abs(bAvg - totalYears);
      });
    if (sorted[0]) return sorted[0].text;
  }

  if (q.includes("degree") || q.includes("bachelor") || q.includes("education")) {
    const yesOpt = options.find((o) => /^yes/i.test(o.trim()));
    if (yesOpt && profileSummary.toLowerCase().includes("education:")) return yesOpt;
  }

  if (q.includes("programming") || q.includes("language") || q.includes("coding")) {
    const yesOpt = options.find((o) => /^yes/i.test(o.trim()));
    if (yesOpt && profileSummary.toLowerCase().includes("skills:")) return yesOpt;
  }

  return options[0] || "";
}

async function processSelectJob(
  job: Job<LlmJobData, LlmJobResult>
): Promise<LlmJobResult> {
  const { company, experiences = [], question, role, selectOptions, profileSummary } = job.data;

  if (!openai) {
    console.log(`[worker-llm] No OpenAI key, using select fallback for job ${job.id}`);
    return {
      mode: "select",
      answer: buildSelectFallbackAnswer(question, selectOptions || [], profileSummary || "", experiences),
    };
  }

  const prompt = [
    `Candidate Profile: ${profileSummary || "Not provided"}`,
    `Company: ${company || "Not provided"}`,
    `Role: ${role || "Not provided"}`,
    "",
    `Question: ${question}`,
    `Available Options:`,
    ...(selectOptions || []).map((o, i) => `  ${i + 1}. ${o}`),
    "",
    "Pick the single best matching option for this candidate. Reply with ONLY the exact option text.",
  ].join("\n");

  console.log(`[worker-llm] Calling LLM for select question, job ${job.id}`);

  const completion = await openai.chat.completions.create({
    model: llmEnv.openaiModel,
    messages: [
      {
        role: "system",
        content:
          "You are a job application assistant. Given a candidate profile and a multiple-choice question, pick the best matching option. Reply with ONLY the exact option text, no explanation.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
  });

  const answer = (completion.choices[0]?.message?.content ?? "").trim();
  console.log(`[worker-llm] LLM selected "${answer}" for job ${job.id}`);
  return { mode: "select", answer };
}

export async function processAutofillJob(
  job: Job<LlmJobData, LlmJobResult>
): Promise<LlmJobResult> {
  const mode = job.data.mode || "select";

  switch (mode) {
    case "scoring":
      return processScoringJob(job);

    case "select":
      return processSelectJob(job);

    // TODO: refactor into synthesis mode
    case "synthesis":
      console.warn(`[worker-llm] Synthesis mode not yet implemented, job ${job.id}`);
      return { mode: "synthesis", answer: "" };

    default:
      console.error(`[worker-llm] Unknown mode "${mode}" for job ${job.id}`);
      return { mode: "select", answer: "" };
  }
}
