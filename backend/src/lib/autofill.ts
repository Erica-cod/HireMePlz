import { createHash } from "node:crypto";
import type { Education, Experience, Profile, StoryItem } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import { llmQueue, llmQueueEvents } from "./llm-queue.js";
import type { LlmJobResult } from "./llm-queue.js";

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

type StructuredRuleKey =
  | "fullName"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "location"
  | "school"
  | "degree"
  | "fieldOfStudy"
  | "graduationYear"
  | "linkedinUrl"
  | "githubUrl"
  | "portfolioUrl"
  | "visaStatus"
  | "skills";

const structuredRules: Array<{
  key: StructuredRuleKey;
  aliases: string[];
}> = [
  { key: "email", aliases: ["email", "e-mail", "email address"] },
  { key: "firstName", aliases: ["first name", "given name", "fname"] },
  { key: "lastName", aliases: ["last name", "surname", "family name", "lname"] },
  { key: "fullName", aliases: ["full name", "name", "legal name"] },
  { key: "phone", aliases: ["phone", "mobile", "contact number"] },
  { key: "location", aliases: ["location", "city", "address"] },
  { key: "school", aliases: ["school", "university", "college", "institution", "school name"] },
  { key: "degree", aliases: ["degree", "education level"] },
  { key: "fieldOfStudy", aliases: ["area of study", "area(s) of study", "field of study", "major", "program", "concentration", "discipline", "specialization"] },
  { key: "graduationYear", aliases: ["graduation year", "grad year", "expected graduation", "year of graduation"] },
  { key: "linkedinUrl", aliases: ["linkedin", "linkedin profile", "linkedin url"] },
  { key: "githubUrl", aliases: ["github", "github profile", "github url"] },
  { key: "portfolioUrl", aliases: ["portfolio", "website", "personal site"] },
  { key: "visaStatus", aliases: ["visa", "work authorization", "sponsorship"] },
  { key: "skills", aliases: ["skills", "technical skills", "programming languages", "technologies"] }
];

function normalizeText(...parts: Array<string | undefined>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();
}

function normalizeCacheKeyPart(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}

function normalizeQuestionText(question: string) {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildQuestionHash(question: string) {
  return createHash("sha256").update(normalizeQuestionText(question)).digest("hex");
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

function getStructuredValue(params: {
  profile: Profile | null;
  educations: Education[];
  key: StructuredRuleKey;
  userEmail?: string;
}) {
  const { key, profile, educations, userEmail } = params;
  const latestEdu = educations[0] ?? null;

  if (key === "email") {
    return userEmail || "";
  }

  if (key === "firstName") {
    return profile?.fullName?.trim().split(/\s+/)[0] || "";
  }

  if (key === "lastName") {
    const parts = profile?.fullName?.trim().split(/\s+/) || [];
    return parts.length > 1 ? parts[parts.length - 1] : "";
  }

  if (key === "fieldOfStudy") {
    return latestEdu?.fieldOfStudy || profile?.degree || "";
  }

  if (key === "school") {
    return latestEdu?.school || profile?.school || "";
  }

  if (key === "degree") {
    return latestEdu?.degree || profile?.degree || "";
  }

  if (key === "graduationYear") {
    if (latestEdu?.endDate) {
      return String(latestEdu.endDate.getFullYear());
    }
    return profile?.graduationYear ? String(profile.graduationYear) : "";
  }

  if (key === "skills") {
    return profile?.skills?.join(", ") || "";
  }

  if (!profile) {
    return "";
  }

  const value = profile[key as keyof Profile];
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
  profile: Profile | null,
  educations: Education[],
  userEmail?: string
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

    const value = getStructuredValue({ profile, educations, key: rule.key, userEmail });
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
  userId: string;
  question: string;
  company?: string;
  role?: string;
  story: StoryItem | null;
  experiences: Experience[];
}) {
  const { company, experiences, question, role, story, userId } = params;

  const job = await llmQueue.add(
    "autofill",
    {
      userId,
      question,
      company,
      role,
      story: story
        ? {
            title: story.title,
            situation: story.situation,
            task: story.task,
            action: story.action,
            result: story.result
          }
        : null,
      experiences: experiences.slice(0, 3).map((exp) => ({
        title: exp.title,
        description: exp.description
      }))
    },
    { removeOnComplete: 100, removeOnFail: 200 }
  );

  try {
    const result = (await job.waitUntilFinished(
      llmQueueEvents,
      env.LLM_JOB_TIMEOUT_MS
    )) as LlmJobResult;
    return result.answer;
  } catch {
    return buildFallbackAnswer(question, company, role, story, experiences);
  }
}

export async function buildSuggestions(params: {
  userId: string;
  fields: AutofillFieldInput[];
  profile: Profile | null;
  educations: Education[];
  userEmail?: string;
  stories: StoryItem[];
  experiences: Experience[];
  company?: string;
  role?: string;
}) {
  const { company, educations, experiences, fields, profile, role, stories, userEmail, userId } = params;
  const suggestions: AutofillSuggestion[] = [];

  for (const field of fields) {
    if (isOpenQuestion(field)) {
      const question =
        field.label || field.placeholder || field.nearbyText || field.name || "";
      const questionHash = buildQuestionHash(question);
      const companyKey = normalizeCacheKeyPart(company);
      const roleKey = normalizeCacheKeyPart(role);
      const cachedAnswer = await prisma.answerMemory.findUnique({
        where: {
          userId_questionHash_companyKey_roleKey: {
            userId,
            questionHash,
            companyKey,
            roleKey
          }
        }
      });

      if (cachedAnswer?.answer) {
        await prisma.answerMemory.update({
          where: {
            userId_questionHash_companyKey_roleKey: {
              userId,
              questionHash,
              companyKey,
              roleKey
            }
          },
          data: {
            hitCount: { increment: 1 },
            lastUsedAt: new Date()
          }
        });

        suggestions.push({
          fieldId: field.id,
          label: field.label || field.name || field.id,
          kind: "open_ended",
          confidence: 0.92,
          value: cachedAnswer.answer,
          reasoning: "Reused previously generated answer from answer memory cache"
        });
        continue;
      }

      const story = pickRelevantStory(question, stories);
      const value = await buildOpenEndedAnswer({
        userId,
        question,
        company,
        role,
        story,
        experiences
      });
      await prisma.answerMemory.upsert({
        where: {
          userId_questionHash_companyKey_roleKey: {
            userId,
            questionHash,
            companyKey,
            roleKey
          }
        },
        create: {
          userId,
          questionHash,
          companyKey,
          roleKey,
          question,
          answer: value,
          hitCount: 1,
          lastUsedAt: new Date()
        },
        update: {
          question,
          answer: value,
          hitCount: { increment: 1 },
          lastUsedAt: new Date()
        }
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

    const structured = scoreStructuredField(field, profile, educations, userEmail);
    if (structured) {
      suggestions.push(structured);
    }
  }

  return suggestions;
}
