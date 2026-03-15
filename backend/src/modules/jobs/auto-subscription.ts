import { JobSite, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

const AUTO_SUBSCRIPTION_NAME = "Profile Auto Subscription";

function normalizeStringList(values: string[]) {
  return Array.from(
    new Set(values.map((v) => v.trim()).filter((v) => v.length > 0))
  );
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

function buildProfileDrivenPayload(profile: {
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
    isRemote: null as boolean | null,
    jobTypes: [] as string[],
    sites: [JobSite.indeed],
    countryIndeed: inferCountryIndeedFromProfileLocation(profile.location),
    hoursOld: 72,
    resultsWanted: 30,
    runEveryMinutes: 60
  };
}

export async function upsertAutoSubscriptionFromProfile(userId: string) {
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

  const payload = buildProfileDrivenPayload(profile);
  if (!payload) {
    return null;
  }

  const existing = await prisma.jobSubscription.findFirst({
    where: { userId, name: AUTO_SUBSCRIPTION_NAME }
  });

  if (existing) {
    const subscription = await prisma.jobSubscription.update({
      where: { id: existing.id },
      data: {
        keywords: payload.keywords,
        locations: payload.locations,
        sites: payload.sites,
        countryIndeed: payload.countryIndeed,
        nextRunAt: existing.nextRunAt ?? new Date()
      }
    });
    return { subscription, created: false };
  }

  const subscription = await prisma.jobSubscription.create({
    data: {
      userId,
      ...payload,
      nextRunAt: new Date()
    } satisfies Prisma.JobSubscriptionUncheckedCreateInput
  });

  return { subscription, created: true };
}
