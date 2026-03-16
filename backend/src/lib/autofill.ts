import type { Education, Experience, Profile, StoryItem } from "@prisma/client";

import { env } from "../config/env.js";
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
  kind: "structured" | "open_ended" | "no_match";
  confidence: number;
  value: string;
  reasoning: string;
  sourceStoryId?: string;
  sourceStoryTitle?: string;
  matchScore?: number;
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

function isOpenQuestion(field: AutofillFieldInput) {
  if (field.tagName === "SELECT") return false;

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
    text.includes("challenge")
  );
}

function isSelectQuestion(field: AutofillFieldInput) {
  return field.tagName === "SELECT" && Array.isArray(field.options) && field.options.length > 1;
}

type SelectQuestionContext = {
  profile: Profile | null;
  educations: Education[];
  experiences: Experience[];
};

function answerSelectByRules(
  question: string,
  options: string[],
  ctx: SelectQuestionContext
): string | null {
  const q = question.toLowerCase();
  const validOptions = options.filter((o) => o.trim() && !o.toLowerCase().includes("select"));
  if (validOptions.length === 0) return null;

  const yesOption = validOptions.find((o) => /^yes/i.test(o.trim()));
  const noOption = validOptions.find((o) => /^no/i.test(o.trim()));

  if (q.includes("bachelor") && q.includes("degree")) {
    const hasBachelors = ctx.educations.some((e) => {
      const d = e.degree.toLowerCase();
      return d.includes("bachelor") || d.includes("master") || d.includes("phd") || d.includes("doctor");
    }) || (() => {
      const d = (ctx.profile?.degree || "").toLowerCase();
      return d.includes("bachelor") || d.includes("master") || d.includes("meng") || d.includes("msc") || d.includes("phd");
    })();
    if (yesOption && noOption) return hasBachelors ? yesOption : noOption;
  }

  if (q.includes("programming") && q.includes("language")) {
    const hasSkills = (ctx.profile?.skills?.length ?? 0) > 0;
    if (yesOption && noOption) return hasSkills ? yesOption : noOption;
  }

  if (q.includes("work visa") || q.includes("visa sponsorship") || q.includes("require sponsor")) {
    const visa = (ctx.profile?.visaStatus || "").toLowerCase();
    const needsVisa = !visa || visa.includes("visa") || visa.includes("sponsor") || visa.includes("need");
    if (yesOption && noOption) return needsVisa ? yesOption : noOption;
  }

  if (q.includes("authorized to work") || q.includes("legally authorized") || q.includes("work authorization")) {
    if (yesOption && noOption) return yesOption;
  }

  if (q.includes("experience") && (q.includes("total") || q.includes("how many") || q.includes("years"))) {
    const totalMonths = ctx.experiences.reduce((sum, exp) => {
      if (!exp.startDate) return sum;
      const end = exp.endDate || new Date();
      return sum + Math.max(0, (end.getTime() - exp.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    }, 0);
    const years = totalMonths / 12;

    return pickClosestExperienceOption(validOptions, years);
  }

  if (q.includes("gender") || q.includes("race") || q.includes("ethnicity") || q.includes("veteran") || q.includes("disability")) {
    const declineOption = validOptions.find((o) => {
      const ol = o.toLowerCase();
      return ol.includes("decline") || ol.includes("prefer not") || ol.includes("do not wish");
    });
    if (declineOption) return declineOption;
  }

  return null;
}

function pickClosestExperienceOption(options: string[], years: number): string | null {
  let bestOption: string | null = null;
  let bestDistance = Infinity;

  for (const opt of options) {
    const numbers = opt.match(/(\d+)/g)?.map(Number) || [];
    if (numbers.length === 0) {
      if (/less than 1|no experience|none/i.test(opt) && years < 1) return opt;
      continue;
    }

    const target = numbers.length >= 2
      ? (numbers[0] + numbers[1]) / 2
      : numbers[0];

    const distance = Math.abs(years - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOption = opt;
    }
  }

  return bestOption;
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

function buildProfileSummary(
  profile: Profile | null,
  educations: Education[],
  experiences: Experience[]
) {
  const parts: string[] = [];
  if (profile?.fullName) parts.push(`Name: ${profile.fullName}`);
  if (profile?.location) parts.push(`Location: ${profile.location}`);
  if (profile?.skills?.length) parts.push(`Skills: ${profile.skills.join(", ")}`);
  if (profile?.visaStatus) parts.push(`Visa: ${profile.visaStatus}`);

  for (const edu of educations.slice(0, 2)) {
    parts.push(`Education: ${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""} at ${edu.school}`);
  }

  for (const exp of experiences.slice(0, 3)) {
    const duration = exp.startDate
      ? `${exp.startDate.getFullYear()}-${exp.endDate ? exp.endDate.getFullYear() : "present"}`
      : "";
    parts.push(`Experience: ${exp.title}${duration ? ` (${duration})` : ""}`);
  }

  return parts.join("; ");
}

async function answerSelectByLLM(params: {
  userId: string;
  question: string;
  options: string[];
  profile: Profile | null;
  educations: Education[];
  experiences: Experience[];
  company?: string;
  role?: string;
}): Promise<string | null> {
  const { userId, question, options, profile, educations, experiences, company, role } = params;
  const validOptions = options.filter((o) => o.trim() && !o.toLowerCase().includes("select an option"));

  if (validOptions.length === 0) return null;

  const profileSummary = buildProfileSummary(profile, educations, experiences);
  const formattedQuestion = `Given these options for the question "${question}", pick the single best option that matches this candidate's profile. Options: ${validOptions.join(" | ")}. Reply with ONLY the exact option text, nothing else.`;

  const job = await llmQueue.add(
    "select-question",
    {
      mode: "select",
      userId,
      question: formattedQuestion,
      company,
      role,
      story: null,
      experiences: experiences.slice(0, 3).map((exp) => ({
        title: exp.title,
        description: exp.description
      })),
      selectOptions: validOptions,
      profileSummary
    },
    { removeOnComplete: 100, removeOnFail: 200 }
  );

  try {
    const result = (await job.waitUntilFinished(
      llmQueueEvents,
      env.LLM_JOB_TIMEOUT_MS
    )) as LlmJobResult;

    const answer = (result.answer ?? "").trim();
    const matched = validOptions.find(
      (o) => o.trim().toLowerCase() === answer.toLowerCase()
    );
    return matched || validOptions.find((o) => answer.toLowerCase().includes(o.toLowerCase())) || null;
  } catch {
    return null;
  }
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

async function scoreStoriesByLLM(params: {
  userId: string;
  question: string;
  stories: StoryItem[];
  company?: string;
  role?: string;
}): Promise<{ story: StoryItem; score: number } | null> {
  const { userId, question, stories, company, role } = params;

  if (stories.length === 0) return null;

  const job = await llmQueue.add(
    "score-stories",
    {
      mode: "scoring",
      userId,
      question,
      company,
      role,
      stories: stories.map((s) => ({ id: s.id, title: s.title, content: s.content })),
    },
    { removeOnComplete: 100, removeOnFail: 200 }
  );

  try {
    const result = (await job.waitUntilFinished(
      llmQueueEvents,
      env.LLM_JOB_TIMEOUT_MS
    )) as LlmJobResult;

    const scores = result.scores ?? [];
    if (scores.length === 0) return null;

    const best = scores.reduce((a, b) => (a.score >= b.score ? a : b));
    if (best.score < env.STORY_MATCH_THRESHOLD) return null;

    const matched = stories.find((s) => s.id === best.storyId);
    if (!matched) return null;

    return { story: matched, score: best.score };
  } catch {
    return null;
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

      const match = await scoreStoriesByLLM({
        userId,
        question,
        stories,
        company,
        role,
      });

      if (match) {
        suggestions.push({
          fieldId: field.id,
          label: field.label || field.name || field.id,
          kind: "open_ended",
          confidence: match.score,
          value: match.story.content,
          reasoning: `Matched story: ${match.story.title} (score: ${match.score.toFixed(2)})`,
          sourceStoryId: match.story.id,
          sourceStoryTitle: match.story.title,
          matchScore: match.score,
        });
      } else {
        suggestions.push({
          fieldId: field.id,
          label: field.label || field.name || field.id,
          kind: "no_match",
          confidence: 0,
          value: "",
          reasoning: "No story matched above the relevance threshold",
        });
      }
      continue;
    }

    const structured = scoreStructuredField(field, profile, educations, userEmail);
    if (structured) {
      suggestions.push(structured);
      continue;
    }

    if (isSelectQuestion(field)) {
      const question = field.label || field.nearbyText || field.name || "";
      const options = field.options!;

      const ruleAnswer = answerSelectByRules(question, options, {
        profile,
        educations,
        experiences
      });

      if (ruleAnswer) {
        suggestions.push({
          fieldId: field.id,
          label: field.label || field.name || field.id,
          kind: "structured",
          confidence: 0.8,
          value: ruleAnswer,
          reasoning: "Matched by qualification question rules"
        });
        continue;
      }

      const llmAnswer = await answerSelectByLLM({
        userId,
        question,
        options,
        profile,
        educations,
        experiences,
        company,
        role
      });

      if (llmAnswer) {
        suggestions.push({
          fieldId: field.id,
          label: field.label || field.name || field.id,
          kind: "structured",
          confidence: 0.7,
          value: llmAnswer,
          reasoning: "Selected by LLM from available options"
        });
      }
    }
  }

  return suggestions;
}
