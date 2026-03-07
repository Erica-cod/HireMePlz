import { prisma } from "../lib/prisma.js";

const seededJobs = [
  {
    company: "ExampleAI",
    title: "Software Engineer Intern",
    location: "Toronto, ON",
    applyUrl: "https://example.com/jobs/se-intern",
    description: "Build web applications with TypeScript and cloud services.",
    skills: ["typescript", "react", "node.js"]
  },
  {
    company: "NorthCloud",
    title: "Backend Developer",
    location: "Remote",
    applyUrl: "https://example.com/jobs/backend-dev",
    description: "Work on APIs, databases and containerized services.",
    skills: ["node.js", "postgresql", "docker"]
  },
  {
    company: "GreenByte",
    title: "Full Stack Engineer",
    location: "Vancouver, BC",
    applyUrl: "https://example.com/jobs/full-stack",
    description: "Own product features from UI to backend deployment.",
    skills: ["react", "next.js", "express", "cloud"]
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

export async function seedJobsAndMatches() {
  for (const job of seededJobs) {
    await prisma.job.upsert({
      where: {
        source_applyUrl: {
          source: "seed",
          applyUrl: job.applyUrl
        }
      },
      update: {
        ...job
      },
      create: {
        ...job,
        source: "seed"
      }
    });
  }

  const users = await prisma.user.findMany({
    include: { profile: true }
  });
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
    }
  }
}
