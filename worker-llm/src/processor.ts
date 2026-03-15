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
  selectOptions?: string[];
  profileSummary?: string;
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

function buildSelectFallbackAnswer(
  question: string,
  options: string[],
  profileSummary: string,
  experiences: LlmJobData["experiences"]
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

export async function processAutofillJob(
  job: Job<LlmJobData, LlmJobResult>
): Promise<LlmJobResult> {
  const { company, experiences, question, role, story, selectOptions, profileSummary } = job.data;

  const isSelectQuestion = Array.isArray(selectOptions) && selectOptions.length > 0;

  if (!openai) {
    console.log(`[worker-llm] No OpenAI key, using fallback for job ${job.id}`);
    if (isSelectQuestion) {
      return { answer: buildSelectFallbackAnswer(question, selectOptions, profileSummary || "", experiences) };
    }
    return { answer: buildFallbackAnswer(question, company, role, story, experiences) };
  }

  if (isSelectQuestion) {
    const prompt = [
      `Candidate Profile: ${profileSummary || "Not provided"}`,
      `Company: ${company || "Not provided"}`,
      `Role: ${role || "Not provided"}`,
      "",
      `Question: ${question}`,
      `Available Options:`,
      ...selectOptions.map((o, i) => `  ${i + 1}. ${o}`),
      "",
      "Pick the single best matching option for this candidate. Reply with ONLY the exact option text."
    ].join("\n");

    console.log(`[worker-llm] Calling LLM for select question, job ${job.id}`);

    const completion = await openai.chat.completions.create({
      model: llmEnv.openaiModel,
      messages: [
        { role: "system", content: "You are a job application assistant. Given a candidate profile and a multiple-choice question, pick the best matching option. Reply with ONLY the exact option text, no explanation." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    });

    const answer = (completion.choices[0]?.message?.content ?? "").trim();
    console.log(`[worker-llm] LLM selected "${answer}" for job ${job.id}`);
    return { answer };
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

  const raw = (completion.choices[0]?.message?.content ?? "").trim();
  // For some 3rd-party LLM, remove the <think> tag from the response.
  const answer = raw.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
  console.log(`[worker-llm] LLM returned ${answer.length} chars for job ${job.id}`);

  return { answer };
}
