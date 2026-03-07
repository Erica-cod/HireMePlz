import { JobSource, Prisma, type JobSubscription } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { fetchJobsWithJobSpy, type JobSpyJob } from "./jobSpyClient.js";

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
    reasons.push(`技能匹配：${overlap.join(", ")}`);
  }

  const roleMatch = params.preferredRoles.find((role) =>
    params.job.title.toLowerCase().includes(role.toLowerCase())
  );
  if (roleMatch) {
    score += 0.25;
    reasons.push(`岗位偏好匹配：${roleMatch}`);
  }

  const cityMatch = params.preferredCities.find((city) =>
    (params.job.location || "").toLowerCase().includes(city.toLowerCase())
  );
  if (cityMatch) {
    score += 0.15;
    reasons.push(`地点偏好匹配：${cityMatch}`);
  }

  return {
    score: Math.min(0.99, Number(score.toFixed(2))),
    reasons:
      reasons.length > 0
        ? reasons
        : ["当前仅命中少量基础规则，建议人工复核。"]
  };
}

function normalizeStringList(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

function normalizePostedAt(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toOptionalInt(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  return Math.round(value);
}

function buildLocation(rawJob: JobSpyJob) {
  if (rawJob.locationText?.trim()) {
    return rawJob.locationText.trim();
  }

  const parts = [rawJob.location?.city, rawJob.location?.state, rawJob.location?.country].filter(
    Boolean
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizeJobPayload(rawJob: JobSpyJob, subscription: JobSubscription, keyword: string) {
  return {
    externalId: rawJob.externalId ?? null,
    sourceSite: rawJob.site ?? subscription.sites[0] ?? null,
    sourceQuery: keyword,
    company: rawJob.company.trim(),
    companyUrl: rawJob.companyUrl ?? null,
    title: rawJob.title.trim(),
    location: buildLocation(rawJob),
    city: rawJob.location?.city ?? null,
    state: rawJob.location?.state ?? null,
    country: rawJob.location?.country ?? null,
    isRemote: rawJob.isRemote ?? null,
    applyUrl: rawJob.jobUrl.trim(),
    description: rawJob.description ?? null,
    skills: normalizeStringList(rawJob.skills || []),
    jobType: rawJob.jobType ?? null,
    jobLevel: rawJob.jobLevel ?? null,
    salaryMin: toOptionalInt(rawJob.salary?.minAmount),
    salaryMax: toOptionalInt(rawJob.salary?.maxAmount),
    salaryCurrency: rawJob.salary?.currency ?? null,
    salaryInterval: rawJob.salary?.interval ?? null,
    rawPayload: rawJob.rawPayload ?? rawJob,
    postedAt: normalizePostedAt(rawJob.postedAt)
  };
}

async function refreshMatchesForUser(userId: string, jobIds: string[]) {
  const uniqueJobIds = Array.from(new Set(jobIds));
  if (uniqueJobIds.length === 0) {
    return 0;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });
  const profile = user?.profile;

  if (!profile) {
    return 0;
  }

  const jobs = await prisma.job.findMany({
    where: {
      id: {
        in: uniqueJobIds
      }
    }
  });

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
          userId,
          jobId: job.id
        }
      },
      update: match,
      create: {
        userId,
        jobId: job.id,
        ...match
      }
    });
  }

  return jobs.length;
}

async function ingestJobsForSubscription(subscription: JobSubscription) {
  const keywords = normalizeStringList(subscription.keywords);
  if (keywords.length === 0) {
    throw new Error("当前订阅没有配置关键词，无法执行职位抓取。");
  }

  const locations = normalizeStringList(subscription.locations);
  const jobTypes = normalizeStringList(subscription.jobTypes);
  const jobIds: string[] = [];
  const keywordRuns: Prisma.InputJsonObject[] = [];

  let fetchedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;

  for (const keyword of keywords) {
    const fetchResult = await fetchJobsWithJobSpy({
      keyword,
      locations,
      isRemote: subscription.isRemote,
      jobTypes,
      sites: subscription.sites,
      countryIndeed: subscription.countryIndeed,
      hoursOld: subscription.hoursOld,
      resultsWanted: subscription.resultsWanted,
      userId: subscription.userId,
      subscriptionId: subscription.id
    });

    fetchedCount += fetchResult.jobs.length;

    for (const rawJob of fetchResult.jobs) {
      if (!rawJob.title?.trim() || !rawJob.company?.trim() || !rawJob.jobUrl?.trim()) {
        continue;
      }

      const jobData = normalizeJobPayload(rawJob, subscription, keyword);
      const existingJob = await prisma.job.findUnique({
        where: {
          source_applyUrl: {
            source: JobSource.jobspy,
            applyUrl: jobData.applyUrl
          }
        },
        select: { id: true }
      });

      const savedJob = await prisma.job.upsert({
        where: {
          source_applyUrl: {
            source: JobSource.jobspy,
            applyUrl: jobData.applyUrl
          }
        },
        update: jobData,
        create: {
          ...jobData,
          source: JobSource.jobspy
        }
      });

      if (existingJob) {
        updatedCount += 1;
      } else {
        insertedCount += 1;
      }

      jobIds.push(savedJob.id);
    }

    keywordRuns.push({
      keyword,
      fetchedCount: fetchResult.jobs.length,
      meta: fetchResult.meta as Prisma.InputJsonValue
    });
  }

  const matchedCount = await refreshMatchesForUser(subscription.userId, jobIds);

  return {
    fetchedCount,
    insertedCount,
    updatedCount,
    matchedCount,
    meta: {
      keywordRuns
    } as Prisma.InputJsonObject
  };
}

async function processSubscription(subscription: JobSubscription) {
  const startedAt = new Date();

  await prisma.jobSubscription.update({
    where: { id: subscription.id },
    data: {
      lastStatus: "running",
      lastError: null
    }
  });

  const run = await prisma.jobIngestionRun.create({
    data: {
      subscriptionId: subscription.id,
      status: "running",
      startedAt
    }
  });

  try {
    const result = await ingestJobsForSubscription(subscription);
    const finishedAt = new Date();

    await prisma.jobIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt,
        fetchedCount: result.fetchedCount,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        matchedCount: result.matchedCount,
        meta: result.meta
      }
    });

    await prisma.jobSubscription.update({
      where: { id: subscription.id },
      data: {
        lastRunAt: startedAt,
        nextRunAt: new Date(startedAt.getTime() + subscription.runEveryMinutes * 60 * 1000),
        lastStatus: "success",
        lastError: null
      }
    });

    return result;
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "unknown error";

    await prisma.jobIngestionRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt,
        errorMessage: message
      }
    });

    await prisma.jobSubscription.update({
      where: { id: subscription.id },
      data: {
        lastRunAt: startedAt,
        nextRunAt: new Date(startedAt.getTime() + subscription.runEveryMinutes * 60 * 1000),
        lastStatus: "failed",
        lastError: message
      }
    });

    throw error;
  }
}

export async function processDueJobSubscriptions() {
  const subscriptions = await prisma.jobSubscription.findMany({
    where: {
      enabled: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }]
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }]
  });

  if (subscriptions.length === 0) {
    return {
      processedSubscriptions: 0,
      successCount: 0,
      failureCount: 0
    };
  }

  let successCount = 0;
  let failureCount = 0;

  for (const subscription of subscriptions) {
    try {
      const result = await processSubscription(subscription);
      successCount += 1;
      console.log(
        `[worker] Completed subscription ${subscription.id}: fetched=${result.fetchedCount}, inserted=${result.insertedCount}, updated=${result.updatedCount}, matched=${result.matchedCount}`
      );
    } catch (error) {
      failureCount += 1;
      console.error(`[worker] Subscription ${subscription.id} failed`, error);
    }
  }

  return {
    processedSubscriptions: subscriptions.length,
    successCount,
    failureCount
  };
}
