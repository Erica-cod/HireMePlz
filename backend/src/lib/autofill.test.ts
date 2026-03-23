import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Education, Experience, Profile, StoryItem } from "@prisma/client";
import type { AutofillFieldInput } from "./autofill.js";

const waitUntilFinished = vi.fn();

vi.mock("../config/env.js", () => ({
  env: {
    LLM_JOB_TIMEOUT_MS: 10_000,
    STORY_MATCH_THRESHOLD: 0.6,
    LLM_AUTOFILL_MODE: "scoring" as const
  }
}));

vi.mock("./llm-queue.js", () => ({
  llmQueue: {
    add: vi.fn(() => ({ waitUntilFinished }))
  },
  llmQueueEvents: {}
}));

import { buildSuggestions } from "./autofill.js";
import { llmQueue } from "./llm-queue.js";

function baseProfile(over: Partial<Profile> = {}): Profile {
  const now = new Date();
  return {
    id: "prof1",
    userId: "user1",
    fullName: "Test User",
    phone: null,
    location: null,
    school: null,
    degree: "MEng",
    graduationYear: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    visaStatus: "Authorized to work without sponsorship",
    preferredRoles: [],
    preferredCities: [],
    skills: [],
    summary: null,
    createdAt: now,
    updatedAt: now,
    ...over
  };
}

function baseEducation(over: Partial<Education> = {}): Education {
  const now = new Date();
  return {
    id: "edu1",
    userId: "user1",
    school: "University of Toronto",
    degree: "MEng",
    fieldOfStudy: "ECE",
    startDate: null,
    endDate: null,
    description: null,
    createdAt: now,
    updatedAt: now,
    ...over
  };
}

describe("buildSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitUntilFinished.mockResolvedValue({ mode: "scoring", scores: [] });
  });

  it("SELECT bachelor question returns Yes/No, not profile degree text", async () => {
    const field: AutofillFieldInput = {
      id: "bachelors",
      tagName: "SELECT",
      label: "Do you have a bachelor's degree or equivalent?",
      options: ["Select an option", "Yes", "No"]
    };

    const suggestions = await buildSuggestions({
      userId: "user1",
      fields: [field],
      profile: baseProfile({ degree: "MEng" }),
      educations: [baseEducation({ degree: "MEng" })],
      userEmail: "t@test.com",
      stories: [],
      experiences: []
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].value).toBe("Yes");
    expect(suggestions[0].value).not.toBe("MEng");
    expect(vi.mocked(llmQueue.add)).not.toHaveBeenCalled();
  });

  it("SELECT work authorization returns Yes/No, not visaStatus prose", async () => {
    const field: AutofillFieldInput = {
      id: "work_auth",
      tagName: "SELECT",
      label:
        "Are you legally authorized to work in this country without sponsorship?",
      options: ["Select an option", "Yes", "No"]
    };

    const suggestions = await buildSuggestions({
      userId: "user1",
      fields: [field],
      profile: baseProfile({
        visaStatus: "Work authorization — no sponsorship required"
      }),
      educations: [],
      userEmail: "t@test.com",
      stories: [],
      experiences: []
    });

    expect(suggestions).toHaveLength(1);
    expect(["Yes", "No"]).toContain(suggestions[0].value);
    expect(suggestions[0].value).not.toContain("sponsorship required");
    expect(vi.mocked(llmQueue.add)).not.toHaveBeenCalled();
  });

  it("parallel open fields call LLM queue once each", async () => {
    const f1: AutofillFieldInput = {
      id: "t1",
      tagName: "TEXTAREA",
      label: "Please describe a challenge you overcame"
    };
    const f2: AutofillFieldInput = {
      id: "t2",
      tagName: "TEXTAREA",
      label: "Tell us why you want this role"
    };

    waitUntilFinished.mockResolvedValue({ mode: "scoring", scores: [] });

    await buildSuggestions({
      userId: "user1",
      fields: [f1, f2],
      profile: baseProfile(),
      educations: [],
      userEmail: "t@test.com",
      stories: [
        {
          id: "s1",
          userId: "user1",
          title: "Story",
          tags: [],
          content: "Body",
          createdAt: new Date(),
          updatedAt: new Date()
        } as StoryItem
      ],
      experiences: []
    });

    expect(vi.mocked(llmQueue.add)).toHaveBeenCalled();
    const scoreCalls = vi.mocked(llmQueue.add).mock.calls.filter(
      (c) => c[0] === "score-stories"
    );
    expect(scoreCalls.length).toBe(2);
  });
});
