import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";

const router = Router();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().optional()
});

const updateSchema = z.object({
  answer: z.string().trim().min(1)
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const { limit, search } = querySchema.parse(request.query);

    const memories = await prisma.answerMemory.findMany({
      where: {
        userId: request.userId,
        ...(search
          ? {
              question: {
                contains: search,
                mode: "insensitive"
              }
            }
          : {})
      },
      orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }],
      take: limit
    });

    response.json({ memories });
  })
);

router.put(
  "/:memoryId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const memoryId = String(request.params.memoryId);
    const payload = updateSchema.parse(request.body);

    const existing = await prisma.answerMemory.findFirst({
      where: {
        id: memoryId,
        userId: request.userId
      }
    });

    if (!existing) {
      response.status(404).json({ message: "Answer memory not found" });
      return;
    }

    const memory = await prisma.answerMemory.update({
      where: { id: existing.id },
      data: {
        answer: payload.answer,
        lastUsedAt: new Date()
      }
    });

    response.json({ memory });
  })
);

router.delete(
  "/:memoryId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const memoryId = String(request.params.memoryId);

    const existing = await prisma.answerMemory.findFirst({
      where: {
        id: memoryId,
        userId: request.userId
      }
    });

    if (!existing) {
      response.status(404).json({ message: "Answer memory not found" });
      return;
    }

    await prisma.answerMemory.delete({
      where: { id: existing.id }
    });

    response.status(204).send();
  })
);

router.delete(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const result = await prisma.answerMemory.deleteMany({
      where: { userId: request.userId }
    });

    response.json({ deletedCount: result.count });
  })
);

export const answerMemoryRouter = router;
