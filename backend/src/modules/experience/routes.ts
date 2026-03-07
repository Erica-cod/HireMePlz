import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";

const router = Router();

const experienceSchema = z.object({
  title: z.string().min(1),
  company: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  description: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable()
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const experiences = await prisma.experience.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "desc" }
    });

    response.json({ experiences });
  })
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = experienceSchema.parse(request.body);

    const experience = await prisma.experience.create({
      data: {
        userId: request.userId!,
        title: payload.title,
        company: payload.company,
        location: payload.location,
        description: payload.description,
        highlights: payload.highlights,
        skills: payload.skills,
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        endDate: payload.endDate ? new Date(payload.endDate) : null
      }
    });

    response.status(201).json({ experience });
  })
);

router.put(
  "/:experienceId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const experienceId = String(request.params.experienceId);
    const payload = experienceSchema.parse(request.body);
    const existing = await prisma.experience.findFirst({
      where: { id: experienceId, userId: request.userId }
    });

    if (!existing) {
      response.status(404).json({ message: "Experience record not found" });
      return;
    }

    const experience = await prisma.experience.update({
      where: { id: existing.id },
      data: {
        title: payload.title,
        company: payload.company,
        location: payload.location,
        description: payload.description,
        highlights: payload.highlights,
        skills: payload.skills,
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        endDate: payload.endDate ? new Date(payload.endDate) : null
      }
    });

    response.json({ experience });
  })
);

router.delete(
  "/:experienceId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const experienceId = String(request.params.experienceId);
    const existing = await prisma.experience.findFirst({
      where: { id: experienceId, userId: request.userId }
    });

    if (!existing) {
      response.status(404).json({ message: "Experience record not found" });
      return;
    }

    await prisma.experience.delete({
      where: { id: existing.id }
    });

    response.status(204).send();
  })
);

export const experienceRouter = router;
