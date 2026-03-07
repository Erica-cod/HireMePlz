import { prisma } from "../lib/prisma.js";
import { workerEnv } from "../lib/env.js";
import { sendJobAlert } from "../lib/notifications.js";

type CandidateUser = {
  id: string;
  email: string;
  profile: {
    fullName: string | null;
    skills: string[];
    preferredRoles: string[];
    preferredCities: string[];
  } | null;
};

type JobInput = {
  source: "jsearch" | "adzuna" | "seed";
  externalId?: string;
  company: string;
  title: string;
  location: string | null;
  applyUrl: string;
  description: string | null;
  skills: string[];
  postedAt: Date | null;
};

type QueryPair = {
  role: string;
  city: string;
};

const MAX_QUERY_PAIRS = 6;
const ALERT_MIN_SCORE = Math.min(0.99, Math.max(0.5, workerEnv.jobAlertMinScore || 0.75));
const SKILL_KEYWORDS = [
  "typescript",
  "javascript",
  "node.js",
  "react",
  "next.js",
  "express",
  "postgresql",
  "docker",
  "kubernetes",
  "aws",
  "gcp",
  "azure",
  "python",
  "java",
  "go",
  "redis",
  "graphql"
];

const seededJobs: JobInput[] = [
  {
    source: "seed",
    company: "ExampleAI",
    title: "Software Engineer Intern",
    location: "Toronto, ON",
    applyUrl: "https://example.com/jobs/se-intern",
    description: "Build web applications with TypeScript and cloud services.",
    skills: ["typescript", "react", "node.js"],
    postedAt: null
  },
  {
    source: "seed",
    company: "NorthCloud",
    title: "Backend Developer",
    location: "Remote",
    applyUrl: "https://example.com/jobs/backend-dev",
    description: "Work on APIs, databases and containerized services.",
    skills: ["node.js", "postgresql", "docker"],
    postedAt: null
  },
  {
    source: "seed",
    company: "GreenByte",
    title: "Full Stack Engineer",
    location: "Vancouver, BC",
    applyUrl: "https://example.com/jobs/full-stack",
    description: "Own product features from UI to backend deployment.",
    skills: ["react", "next.js", "express", "cloud"],
    postedAt: null
  }
];

function scoreJobMatch(params: {
  userSkills: string[];
  preferredRoles: string[];
  preferredCities: string[];
  job: {
    title: string;
    location: string | null;
    skills: string[];
  };
}) {
  const reasons: string[] = [];
  let score = 0.15;

  const normalizedSkills = new Set(params.userSkills.map((skill) => skill.toLowerCase()));
  const overlap = params.job.skills.filter((skill) =>
    normalizedSkills.has(skill.toLowerCase())
  );

  if (overlap.length > 0) {
    score += Math.min(0.45, overlap.length * 0.15);
    reasons.push(`Skill overlap: ${overlap.join(", ")}`);
  }

  const roleMatch = params.preferredRoles.find((role) =>
    params.job.title.toLowerCase().includes(role.toLowerCase())
  );
  if (roleMatch) {
    score += 0.25;
    reasons.push(`Role preference match: ${roleMatch}`);
  }

  const cityMatch = params.preferredCities.find((city) =>
    (params.job.location || "").toLowerCase().includes(city.toLowerCase())
  );
  if (cityMatch) {
    score += 0.15;
    reasons.push(`Location preference match: ${cityMatch}`);
  }

  return {
    score: Math.min(0.99, Number(score.toFixed(2))),
    reasons:
      reasons.length > 0
        ? reasons
        : ["Few base matching rules were hit. Manual review is recommended."]
  };
}

function extractSkills(text: string) {
  const normalized = text.toLowerCase();
  return SKILL_KEYWORDS.filter((keyword) => normalized.includes(keyword));
}

function parseDate(value: unknown) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildQueryPairs(users: CandidateUser[]) {
  const rolePool = new Set<string>();
  const cityPool = new Set<string>();

  for (const user of users) {
    if (!user.profile) {
      continue;
    }
    for (const role of user.profile.preferredRoles) {
      if (role.trim()) {
        rolePool.add(role.trim());
      }
    }
    for (const city of user.profile.preferredCities) {
      if (city.trim()) {
        cityPool.add(city.trim());
      }
    }
  }

  const roles = Array.from(rolePool).slice(0, 3);
  if (roles.length === 0) {
    roles.push("software engineer");
  }
  const cities = Array.from(cityPool).slice(0, 3);
  if (cities.length === 0) {
    cities.push("");
  }

  const pairs: QueryPair[] = [];
  for (const role of roles) {
    for (const city of cities) {
      pairs.push({ role, city });
    }
  }

  return pairs.slice(0, MAX_QUERY_PAIRS);
}

async function fetchJSearchJobs(pairs: QueryPair[]) {
  if (!workerEnv.jsearchApiKey) {
    return [] as JobInput[];
  }

  const jobs: JobInput[] = [];

  for (const pair of pairs) {
    const query = pair.city ? `${pair.role} in ${pair.city}` : pair.role;
    const params = new URLSearchParams({
      query,
      page: "1",
      num_pages: "1",
      date_posted: "month"
    });

    try {
      const response = await fetch(
        `https://jsearch.p.rapidapi.com/search?${params.toString()}`,
        {
          headers: {
            "X-RapidAPI-Key": workerEnv.jsearchApiKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
          }
        }
      );
      if (!response.ok) {
        continue;
      }

      const body = (await response.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      const rows = body.data || [];

      for (const row of rows) {
        const applyUrl =
          readString(row.job_apply_link) || readString(row.job_google_link);
        if (!applyUrl) {
          continue;
        }

        const title = readString(row.job_title) || "Software Engineer";
        const description = readString(row.job_description) || null;
        const locationParts = [
          readString(row.job_city),
          readString(row.job_state),
          readString(row.job_country)
        ].filter(Boolean);
        const location = locationParts.length > 0 ? locationParts.join(", ") : null;
        const providedSkills = Array.isArray(row.job_required_skills)
          ? row.job_required_skills
              .map((item) => (typeof item === "string" ? item.toLowerCase() : ""))
              .filter(Boolean)
          : [];

        jobs.push({
          source: "jsearch",
          externalId: readString(row.job_id),
          company: readString(row.employer_name) || "Unknown company",
          title,
          location,
          applyUrl,
          description,
          skills:
            providedSkills.length > 0
              ? providedSkills.slice(0, 12)
              : extractSkills([title, description || ""].join(" ")),
          postedAt: parseDate(row.job_posted_at_datetime_utc)
        });
      }
    } catch (error) {
      console.warn("JSearch fetch failed", error);
    }
  }

  return jobs;
}

async function fetchAdzunaJobs(pairs: QueryPair[]) {
  if (!workerEnv.adzunaAppId || !workerEnv.adzunaAppKey) {
    return [] as JobInput[];
  }

  const jobs: JobInput[] = [];

  for (const pair of pairs) {
    const params = new URLSearchParams({
      app_id: workerEnv.adzunaAppId,
      app_key: workerEnv.adzunaAppKey,
      results_per_page: "20",
      what: pair.role
    });
    if (pair.city) {
      params.set("where", pair.city);
    }

    try {
      const response = await fetch(
        `https://api.adzuna.com/v1/api/jobs/ca/search/1?${params.toString()}`
      );
      if (!response.ok) {
        continue;
      }

      const body = (await response.json()) as {
        results?: Array<Record<string, unknown>>;
      };
      const rows = body.results || [];

      for (const row of rows) {
        const applyUrl = readString(row.redirect_url);
        if (!applyUrl) {
          continue;
        }

        const title = readString(row.title) || "Software Engineer";
        const description = readString(row.description) || null;
        const company = readNestedString(row, "company", "display_name");
        const location = readNestedString(row, "location", "display_name");

        jobs.push({
          source: "adzuna",
          externalId: readString(row.id),
          company: company || "Unknown company",
          title,
          location: location || null,
          applyUrl,
          description,
          skills: extractSkills([title, description || ""].join(" ")),
          postedAt: parseDate(row.created)
        });
      }
    } catch (error) {
      console.warn("Adzuna fetch failed", error);
    }
  }

  return jobs;
}

function dedupeJobs(jobs: JobInput[]) {
  const result = new Map<string, JobInput>();
  for (const job of jobs) {
    result.set(`${job.source}::${job.applyUrl}`, job);
  }
  return Array.from(result.values());
}

async function upsertJobs(jobs: JobInput[]) {
  for (const job of jobs) {
    await prisma.job.upsert({
      where: {
        source_applyUrl: {
          source: job.source,
          applyUrl: job.applyUrl
        }
      },
      update: {
        externalId: job.externalId || null,
        company: job.company,
        title: job.title,
        location: job.location,
        description: job.description,
        skills: job.skills,
        postedAt: job.postedAt
      },
      create: {
        source: job.source,
        externalId: job.externalId || null,
        company: job.company,
        title: job.title,
        location: job.location,
        applyUrl: job.applyUrl,
        description: job.description,
        skills: job.skills,
        postedAt: job.postedAt
      }
    });
  }
}

function shouldSendAlert(previousScore: number | null, nextScore: number) {
  if (nextScore < ALERT_MIN_SCORE) {
    return false;
  }
  return previousScore === null || previousScore < ALERT_MIN_SCORE;
}

async function buildMatchesAndNotify(users: CandidateUser[]) {
  const jobs = await prisma.job.findMany();

  for (const user of users) {
    const profile = user.profile;
    if (!profile) {
      continue;
    }

    for (const job of jobs) {
      const match = scoreJobMatch({
        userSkills: profile.skills,
        preferredRoles: profile.preferredRoles,
        preferredCities: profile.preferredCities,
        job
      });

      const previous = await prisma.jobMatch.findUnique({
        where: {
          userId_jobId: {
            userId: user.id,
            jobId: job.id
          }
        },
        select: { score: true }
      });

      await prisma.jobMatch.upsert({
        where: {
          userId_jobId: {
            userId: user.id,
            jobId: job.id
          }
        },
        update: match,
        create: {
          userId: user.id,
          jobId: job.id,
          ...match
        }
      });

      if (shouldSendAlert(previous?.score ?? null, match.score)) {
        try {
          await sendJobAlert({
            toEmail: user.email,
            toName: profile.fullName,
            company: job.company,
            role: job.title,
            location: job.location,
            applyUrl: job.applyUrl,
            score: match.score,
            reasons: match.reasons
          });
        } catch (error) {
          console.warn("Failed to send job alert", error);
        }
      }
    }
  }
}

async function fetchLiveJobs(users: CandidateUser[]) {
  const pairs = buildQueryPairs(users);
  const [jsearchJobs, adzunaJobs] = await Promise.all([
    fetchJSearchJobs(pairs),
    fetchAdzunaJobs(pairs)
  ]);
  return dedupeJobs([...jsearchJobs, ...adzunaJobs]);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNestedString(
  object: Record<string, unknown>,
  key: string,
  nestedKey: string
) {
  const nested = object[key];
  if (!nested || typeof nested !== "object") {
    return "";
  }
  return readString((nested as Record<string, unknown>)[nestedKey]);
}

export async function seedJobsAndMatches() {
  const users = (await prisma.user.findMany({
    include: {
      profile: {
        select: {
          fullName: true,
          skills: true,
          preferredRoles: true,
          preferredCities: true
        }
      }
    }
  })) as CandidateUser[];

  const liveJobs = await fetchLiveJobs(users);
  const jobsToPersist = liveJobs.length > 0 ? liveJobs : seededJobs;
  await upsertJobs(jobsToPersist);
  await buildMatchesAndNotify(users);

  const sourceStats = jobsToPersist.reduce(
    (accumulator, job) => {
      accumulator[job.source] = (accumulator[job.source] || 0) + 1;
      return accumulator;
    },
    {} as Record<string, number>
  );

  console.log(
    `Worker cycle done. persisted=${jobsToPersist.length}, sources=${JSON.stringify(sourceStats)}, alertMinScore=${ALERT_MIN_SCORE}`
  );
}
