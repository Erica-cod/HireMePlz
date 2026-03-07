import { ApplicationStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";

const router = Router();

const applicationSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  jobUrl: z.string().url().optional().nullable().or(z.literal("")),
  status: z.nativeEnum(ApplicationStatus).default(ApplicationStatus.draft),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  autofillPayload: z.unknown().optional().nullable()
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const applications = await prisma.application.findMany({
      where: { userId: request.userId },
      orderBy: { updatedAt: "desc" }
    });

    const stats = applications.reduce(
      (accumulator, application) => {
        accumulator.total += 1;
        accumulator.byStatus[application.status] =
          (accumulator.byStatus[application.status] || 0) + 1;
        return accumulator;
      },
      {
        total: 0,
        byStatus: {} as Record<string, number>
      }
    );

    response.json({ applications, stats });
  })
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = applicationSchema.parse(request.body);

    const application = await prisma.application.create({
      data: {
        userId: request.userId!,
        company: payload.company,
        role: payload.role,
        jobUrl: payload.jobUrl || null,
        status: payload.status,
        source: payload.source,
        notes: payload.notes,
        autofillPayload: payload.autofillPayload ?? undefined
      }
    });

    response.status(201).json({ application });
  })
);

router.patch(
  "/:applicationId/status",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const applicationId = String(request.params.applicationId);
    const payload = z
      .object({
        status: z.nativeEnum(ApplicationStatus)
      })
      .parse(request.body);

    const existing = await prisma.application.findFirst({
      where: { id: applicationId, userId: request.userId }
    });

    if (!existing) {
      response.status(404).json({ message: "Application record not found" });
      return;
    }

    const application = await prisma.application.update({
      where: { id: existing.id },
      data: { status: payload.status }
    });

    response.json({ application });
  })
);

export const applicationRouter = router;
