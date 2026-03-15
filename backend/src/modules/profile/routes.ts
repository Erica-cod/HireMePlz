import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { scrapeTriggerQueue } from "../../lib/scrape-trigger.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { upsertAutoSubscriptionFromProfile } from "../jobs/auto-subscription.js";

const router = Router();

const optionalProfileUrlSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return "";
  }

  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}, z.string().url().optional().nullable().or(z.literal("")));

const profileSchema = z.object({
  fullName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  school: z.string().optional().nullable(),
  degree: z.string().optional().nullable(),
  graduationYear: z.number().int().optional().nullable(),
  linkedinUrl: optionalProfileUrlSchema,
  githubUrl: optionalProfileUrlSchema,
  portfolioUrl: optionalProfileUrlSchema,
  visaStatus: z.string().optional().nullable(),
  preferredRoles: z.array(z.string()).default([]),
  preferredCities: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  summary: z.string().optional().nullable()
});

const educationSchema = z.object({
  school: z.string().min(1),
  degree: z.string().min(1),
  fieldOfStudy: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  description: z.string().optional().nullable()
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const [profile, educations] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: request.userId }
      }),
      prisma.education.findMany({
        where: { userId: request.userId },
        orderBy: { createdAt: "desc" }
      })
    ]);

    response.json({ profile, educations });
  })
);

router.put(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = profileSchema.parse(request.body);

    const profile = await prisma.profile.upsert({
      where: { userId: request.userId },
      update: {
        ...payload,
        linkedinUrl: payload.linkedinUrl || null,
        githubUrl: payload.githubUrl || null,
        portfolioUrl: payload.portfolioUrl || null
      },
      create: {
        userId: request.userId!,
        ...payload,
        linkedinUrl: payload.linkedinUrl || null,
        githubUrl: payload.githubUrl || null,
        portfolioUrl: payload.portfolioUrl || null
      }
    });

    const subResult = await upsertAutoSubscriptionFromProfile(request.userId!);
    if (subResult) {
      await scrapeTriggerQueue.add("profile-save", {
        subscriptionId: subResult.subscription.id,
        userId: request.userId!
      });
    }

    response.json({ profile, subscriptionCreated: subResult?.created ?? false });
  })
);

router.post(
  "/educations",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = educationSchema.parse(request.body);

    const education = await prisma.education.create({
      data: {
        userId: request.userId!,
        school: payload.school,
        degree: payload.degree,
        fieldOfStudy: payload.fieldOfStudy,
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        description: payload.description
      }
    });

    response.status(201).json({ education });
  })
);

router.put(
  "/educations/:educationId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const educationId = String(request.params.educationId);
    const payload = educationSchema.parse(request.body);
    const existing = await prisma.education.findFirst({
      where: { id: educationId, userId: request.userId }
    });

    if (!existing) {
      response.status(404).json({ message: "Education record not found" });
      return;
    }

    const education = await prisma.education.update({
      where: { id: existing.id },
      data: {
        school: payload.school,
        degree: payload.degree,
        fieldOfStudy: payload.fieldOfStudy,
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        description: payload.description
      }
    });

    response.json({ education });
  })
);

router.delete(
  "/educations/:educationId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const educationId = String(request.params.educationId);
    const existing = await prisma.education.findFirst({
      where: { id: educationId, userId: request.userId }
    });

    if (!existing) {
      response.status(404).json({ message: "Education record not found" });
      return;
    }

    await prisma.education.delete({
      where: { id: existing.id }
    });

    response.status(204).send();
  })
);

export const profileRouter = router;
