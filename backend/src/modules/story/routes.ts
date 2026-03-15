import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";

const router = Router();

const storySchema = z.object({
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
  content: z.string().min(1)
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const stories = await prisma.storyItem.findMany({
      where: { userId: request.userId },
      orderBy: { updatedAt: "desc" }
    });

    response.json({ stories });
  })
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = storySchema.parse(request.body);

    const story = await prisma.storyItem.create({
      data: {
        userId: request.userId!,
        ...payload
      }
    });

    response.status(201).json({ story });
  })
);

router.put(
  "/:storyId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const storyId = String(request.params.storyId);
    const payload = storySchema.parse(request.body);
    const existing = await prisma.storyItem.findFirst({
      where: { id: storyId, userId: request.userId }
    });

    if (!existing) {
      response.status(404).json({ message: "Story record not found" });
      return;
    }

    const story = await prisma.storyItem.update({
      where: { id: existing.id },
      data: payload
    });

    response.json({ story });
  })
);

router.delete(
  "/:storyId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const storyId = String(request.params.storyId);
    const existing = await prisma.storyItem.findFirst({
      where: { id: storyId, userId: request.userId }
    });

    if (!existing) {
      response.status(404).json({ message: "Story record not found" });
      return;
    }

    await prisma.storyItem.delete({
      where: { id: existing.id }
    });

    response.status(204).send();
  })
);

export const storyRouter = router;
