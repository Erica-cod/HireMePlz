import { JobSite, type Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";

const router = Router();

const supportedJobTypeSchema = z.enum(["fulltime", "parttime", "internship", "contract"]);

const subscriptionSchema = z.object({
  name: z.string().min(1, "Subscription name is required"),
  enabled: z.boolean().default(true),
  keywords: z.array(z.string().min(1)).min(1, "At least one keyword is required"),
  locations: z.array(z.string()).default([]),
  isRemote: z.boolean().optional().nullable(),
  jobTypes: z.array(supportedJobTypeSchema).default([]),
  sites: z.array(z.nativeEnum(JobSite)).min(1, "At least one site is required"),
  countryIndeed: z.string().optional().nullable().or(z.literal("")),
  hoursOld: z.number().int().min(1).max(24 * 30).optional().nullable(),
  resultsWanted: z.number().int().min(1).max(200).default(20),
  runEveryMinutes: z.number().int().min(5).max(7 * 24 * 60).default(60)
});

const runsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const AUTO_SUBSCRIPTION_NAME = "Profile Auto Subscription";

function normalizeStringList(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

function normalizeSites(values: JobSite[]) {
  return Array.from(new Set(values));
}

function getNextRunAt(
  enabled: boolean,
  existing?: {
    enabled: boolean;
    nextRunAt: Date | null;
  }
) {
  let nextRunAt = existing?.nextRunAt ?? null;
  if (!enabled) {
    nextRunAt = null;
  } else if (!existing || existing.enabled === false || nextRunAt === null) {
    nextRunAt = new Date();
  }

  return nextRunAt;
}

function buildBaseSubscriptionData(payload: z.infer<typeof subscriptionSchema>) {
  const enabled = payload.enabled;
  const keywords = normalizeStringList(payload.keywords);
  const locations = normalizeStringList(payload.locations);
  const jobTypes = normalizeStringList(payload.jobTypes);
  const sites = normalizeSites(payload.sites);

  if (keywords.length === 0) {
    throw new Error("Please provide at least one non-empty keyword");
  }

  if (sites.length === 0) {
    throw new Error("Please select at least one job site");
  }

  return {
    name: payload.name.trim(),
    enabled,
    keywords,
    locations,
    isRemote: payload.isRemote ?? null,
    jobTypes,
    sites,
    countryIndeed: payload.countryIndeed?.trim() || null,
    hoursOld: payload.hoursOld ?? null,
    resultsWanted: payload.resultsWanted,
    runEveryMinutes: payload.runEveryMinutes
  };
}

function buildCreateSubscriptionData(
  userId: string,
  payload: z.infer<typeof subscriptionSchema>
): Prisma.JobSubscriptionUncheckedCreateInput {
  return {
    userId,
    ...buildBaseSubscriptionData(payload),
    nextRunAt: getNextRunAt(payload.enabled)
  };
}

function buildUpdateSubscriptionData(
  payload: z.infer<typeof subscriptionSchema>,
  existing: {
    enabled: boolean;
    nextRunAt: Date | null;
  }
): Prisma.JobSubscriptionUncheckedUpdateInput {
  return {
    ...buildBaseSubscriptionData(payload),
    nextRunAt: getNextRunAt(payload.enabled, existing)
  };
}

async function findOwnedSubscription(subscriptionId: string, userId: string) {
  return prisma.jobSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId
    }
  });
}

function inferCountryIndeedFromProfileLocation(location: string | null | undefined) {
  if (!location) {
    return "USA";
  }

  const normalized = location.toLowerCase();
  if (
    normalized.includes("canada") ||
    normalized.includes("toronto") ||
    normalized.includes("vancouver") ||
    normalized.includes("montreal") ||
    normalized.includes("ottawa")
  ) {
    return "Canada";
  }

  return "USA";
}

function buildProfileDrivenSubscription(profile: {
  preferredRoles: string[];
  preferredCities: string[];
  skills: string[];
  location: string | null;
}) {
  const preferredRoles = normalizeStringList(profile.preferredRoles);
  const preferredCities = normalizeStringList(profile.preferredCities);
  const skills = normalizeStringList(profile.skills);

  const keywordCandidates = preferredRoles.length > 0 ? preferredRoles : skills;
  const keywords = keywordCandidates.slice(0, 3);
  const locations =
    preferredCities.length > 0
      ? preferredCities.slice(0, 5)
      : profile.location
      ? [profile.location]
      : [];

  if (keywords.length === 0) {
    return null;
  }

  return {
    name: AUTO_SUBSCRIPTION_NAME,
    enabled: true,
    keywords,
    locations,
    isRemote: null,
    jobTypes: [],
    sites: [JobSite.indeed],
    countryIndeed: inferCountryIndeedFromProfileLocation(profile.location),
    hoursOld: 72,
    resultsWanted: 30,
    runEveryMinutes: 60
  };
}

async function ensureAutoSubscriptionFromProfile(userId: string) {
  const existing = await prisma.jobSubscription.findFirst({
    where: { userId, name: AUTO_SUBSCRIPTION_NAME }
  });

  if (existing) {
    return existing;
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      preferredRoles: true,
      preferredCities: true,
      skills: true,
      location: true
    }
  });

  if (!profile) {
    return null;
  }

  const payload = buildProfileDrivenSubscription(profile);
  if (!payload) {
    return null;
  }

  return prisma.jobSubscription.create({
    data: {
      ...buildCreateSubscriptionData(userId, payload)
    }
  });
}

router.get(
  "/recommendations",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    await ensureAutoSubscriptionFromProfile(request.userId!);

    const matches = await prisma.jobMatch.findMany({
      where: { userId: request.userId },
      include: { job: true },
      orderBy: { score: "desc" },
      take: 20
    });

    response.json({ matches });
  })
);

router.get(
  "/subscriptions",
  requireAuth,
  async (request: AuthenticatedRequest, response) => {
    const subscriptions = await prisma.jobSubscription.findMany({
      where: { userId: request.userId },
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    response.json({ subscriptions });
  }
);

router.post(
  "/subscriptions",
  requireAuth,
  async (request: AuthenticatedRequest, response) => {
    const payload = subscriptionSchema.parse(request.body);

    const subscription = await prisma.jobSubscription.create({
      data: buildCreateSubscriptionData(request.userId!, payload)
    });

    response.status(201).json({ subscription });
  }
);

router.post(
  "/subscriptions/bootstrap",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const profile = await prisma.profile.findUnique({
      where: { userId: request.userId },
      select: {
        preferredRoles: true,
        preferredCities: true,
        skills: true,
        location: true
      }
    });

    if (!profile) {
      response.status(404).json({ message: "Profile not found" });
      return;
    }

    const payload = buildProfileDrivenSubscription(profile);
    if (!payload) {
      response.status(400).json({
        message:
          "Please fill in preferred roles or skills in your profile before bootstrapping job subscriptions"
      });
      return;
    }

    const existing = await prisma.jobSubscription.findFirst({
      where: {
        userId: request.userId,
        name: AUTO_SUBSCRIPTION_NAME
      }
    });

    if (!existing) {
      const subscription = await prisma.jobSubscription.create({
        data: {
          ...buildCreateSubscriptionData(request.userId!, payload)
        }
      });

      response.status(201).json({ subscription, mode: "created" });
      return;
    }

    const subscription = await prisma.jobSubscription.update({
      where: { id: existing.id },
      data: buildUpdateSubscriptionData(payload, existing)
    });

    response.json({ subscription, mode: "updated" });
  })
);

router.put(
  "/subscriptions/:subscriptionId",
  requireAuth,
  async (request: AuthenticatedRequest, response) => {
    const subscriptionId = String(request.params.subscriptionId);
    const payload = subscriptionSchema.parse(request.body);
    const existing = await findOwnedSubscription(subscriptionId, request.userId!);

    if (!existing) {
      response.status(404).json({ message: "Job subscription not found" });
      return;
    }

    const subscription = await prisma.jobSubscription.update({
      where: { id: existing.id },
      data: buildUpdateSubscriptionData(payload, existing)
    });

    response.json({ subscription });
  }
);

router.delete(
  "/subscriptions/:subscriptionId",
  requireAuth,
  async (request: AuthenticatedRequest, response) => {
    const subscriptionId = String(request.params.subscriptionId);
    const existing = await findOwnedSubscription(subscriptionId, request.userId!);

    if (!existing) {
      response.status(404).json({ message: "Job subscription not found" });
      return;
    }

    await prisma.jobSubscription.delete({
      where: { id: existing.id }
    });

    response.status(204).send();
  }
);

router.get(
  "/subscriptions/:subscriptionId/runs",
  requireAuth,
  async (request: AuthenticatedRequest, response) => {
    const subscriptionId = String(request.params.subscriptionId);
    const { limit } = runsQuerySchema.parse(request.query);
    const existing = await findOwnedSubscription(subscriptionId, request.userId!);

    if (!existing) {
      response.status(404).json({ message: "Job subscription not found" });
      return;
    }

    const runs = await prisma.jobIngestionRun.findMany({
      where: { subscriptionId: existing.id },
      orderBy: { startedAt: "desc" },
      take: limit
    });

    response.json({ runs });
  }
);

export const jobsRouter = router;
