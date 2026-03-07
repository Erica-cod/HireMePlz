import { OpenAI } from "openai";
import type { Experience, Profile, StoryItem } from "@prisma/client";

import { env } from "../config/env.js";

export type AutofillFieldInput = {
  id: string;
  label?: string;
  name?: string;
  placeholder?: string;
  tagName: string;
  type?: string;
  options?: string[];
  nearbyText?: string;
  required?: boolean;
};

export type AutofillSuggestion = {
  fieldId: string;
  label: string;
  kind: "structured" | "open_ended";
  confidence: number;
  value: string;
  reasoning: string;
};

const openai = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

const structuredRules: Array<{
  key: keyof Profile;
  aliases: string[];
}> = [
  { key: "fullName", aliases: ["full name", "name", "legal name"] },
  { key: "phone", aliases: ["phone", "mobile", "contact number"] },
  { key: "location", aliases: ["location", "city", "address"] },
  { key: "school", aliases: ["school", "university", "college"] },
  { key: "degree", aliases: ["degree", "education level", "major"] },
  { key: "linkedinUrl", aliases: ["linkedin", "linkedin profile"] },
  { key: "githubUrl", aliases: ["github", "github profile"] },
  { key: "portfolioUrl", aliases: ["portfolio", "website", "personal site"] },
  { key: "visaStatus", aliases: ["visa", "work authorization", "sponsorship"] }
];

function normalizeText(...parts: Array<string | undefined>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();
}

function isOpenQuestion(field: AutofillFieldInput) {
  const text = normalizeText(
    field.label,
    field.name,
    field.placeholder,
    field.nearbyText
  );

  return (
    field.tagName === "TEXTAREA" ||
    text.includes("describe") ||
    text.includes("tell us") ||
    text.includes("why") ||
    text.includes("experience") ||
    text.includes("challenge")
  );
}

function getProfileValue(profile: Profile | null, key: keyof Profile) {
  if (!profile) {
    return "";
  }

  const value = profile[key];
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

export function scoreStructuredField(
  field: AutofillFieldInput,
  profile: Profile | null
) {
  const normalized = normalizeText(
    field.label,
    field.name,
    field.placeholder,
    field.nearbyText
  );

  let best: AutofillSuggestion | null = null;

  for (const rule of structuredRules) {
    let score = 0;
    for (const alias of rule.aliases) {
      if (normalized.includes(alias)) {
        score += alias.split(" ").length > 1 ? 0.6 : 0.4;
      }
    }

    const value = getProfileValue(profile, rule.key);
    if (!value || score <= 0) {
      continue;
    }

    const suggestion: AutofillSuggestion = {
      fieldId: field.id,
      label: field.label || field.name || field.id,
      kind: "structured",
      confidence: Math.min(0.98, Number(score.toFixed(2))),
      value,
      reasoning: `Matched profile field ${rule.key} from field text`
    };

    if (!best || suggestion.confidence > best.confidence) {
      best = suggestion;
    }
  }

  return best;
}

function pickRelevantStory(question: string, stories: StoryItem[]) {
  const normalized = question.toLowerCase();

  const categoryOrder: Array<StoryItem["category"]> = normalized.includes("why")
    ? ["why_company", "general", "project"]
    : normalized.includes("leader")
      ? ["leadership", "teamwork", "project"]
      : normalized.includes("chall")
        ? ["challenge", "project", "behavioral"]
        : normalized.includes("team")
          ? ["teamwork", "leadership", "behavioral"]
          : ["project", "general", "behavioral"];

  for (const category of categoryOrder) {
    const match = stories.find((story) => story.category === category);
    if (match) {
      return match;
    }
  }

  return stories[0] ?? null;
}

function buildFallbackAnswer(
  question: string,
  company: string | undefined,
  role: string | undefined,
  story: StoryItem | null,
  experiences: Experience[]
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

async function buildOpenEndedAnswer(params: {
  question: string;
  company?: string;
  role?: string;
  story: StoryItem | null;
  experiences: Experience[];
}) {
  const { company, experiences, question, role, story } = params;

  if (!openai) {
    return buildFallbackAnswer(question, company, role, story, experiences);
  }

  const prompt = [
    "You are a job application assistant.",
    "Generate an English answer suitable for a software engineering application form using the user's experience details.",
    "Requirements: natural, specific, not exaggerated, and around 120 to 180 words.",
    `Role: ${role || "Not provided"}`,
    `Company: ${company || "Not provided"}`,
    `Question: ${question}`,
    `Story title: ${story?.title || "Not provided"}`,
    `Situation: ${story?.situation || "Not provided"}`,
    `Task: ${story?.task || "Not provided"}`,
    `Action: ${story?.action || "Not provided"}`,
    `Result: ${story?.result || "Not provided"}`
  ].join("\n");

  const completion = await openai.responses.create({
    model: env.OPENAI_MODEL,
    input: prompt
  });

  return completion.output_text.trim();
}

export async function buildSuggestions(params: {
  fields: AutofillFieldInput[];
  profile: Profile | null;
  stories: StoryItem[];
  experiences: Experience[];
  company?: string;
  role?: string;
}) {
  const { company, experiences, fields, profile, role, stories } = params;
  const suggestions: AutofillSuggestion[] = [];

  for (const field of fields) {
    if (isOpenQuestion(field)) {
      const question =
        field.label || field.placeholder || field.nearbyText || field.name || "";
      const story = pickRelevantStory(question, stories);
      const value = await buildOpenEndedAnswer({
        question,
        company,
        role,
        story,
        experiences
      });

      suggestions.push({
        fieldId: field.id,
        label: field.label || field.name || field.id,
        kind: "open_ended",
        confidence: story ? 0.82 : 0.45,
        value,
        reasoning: story
          ? `Generated from story library item: ${story.title}`
          : "No matching story found, generated from base template"
      });
      continue;
    }

    const structured = scoreStructuredField(field, profile);
    if (structured) {
      suggestions.push(structured);
    }
  }

  return suggestions;
}
