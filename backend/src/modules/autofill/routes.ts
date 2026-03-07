import { Router } from "express";
import { z } from "zod";

import { buildSuggestions } from "../../lib/autofill.js";
import { prisma } from "../../lib/prisma.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";

const router = Router();

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  name: z.string().optional(),
  placeholder: z.string().optional(),
  tagName: z.string().min(1),
  type: z.string().optional(),
  options: z.array(z.string()).optional(),
  nearbyText: z.string().optional(),
  required: z.boolean().optional()
});

const suggestionSchema = z.object({
  company: z.string().optional(),
  role: z.string().optional(),
  fields: z.array(fieldSchema).min(1)
});

router.post(
  "/suggestions",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = suggestionSchema.parse(request.body);

    const [user, profile, stories, experiences] = await Promise.all([
      prisma.user.findUnique({
        where: { id: request.userId },
        select: { email: true }
      }),
      prisma.profile.findUnique({
        where: { userId: request.userId }
      }),
      prisma.storyItem.findMany({
        where: { userId: request.userId },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.experience.findMany({
        where: { userId: request.userId },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    const suggestions = await buildSuggestions({
      fields: payload.fields,
      profile,
      userEmail: user?.email,
      stories,
      experiences,
      company: payload.company,
      role: payload.role
    });

    response.json({ suggestions });
  })
);

router.post(
  "/record",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = z
      .object({
        company: z.string().min(1),
        role: z.string().min(1),
        jobUrl: z.string().url().optional().nullable().or(z.literal("")),
        source: z.string().default("extension"),
        suggestions: z.array(
          z.object({
            fieldId: z.string(),
            label: z.string(),
            kind: z.string(),
            confidence: z.number(),
            value: z.string(),
            reasoning: z.string()
          })
        )
      })
      .parse(request.body);

    const application = await prisma.application.create({
      data: {
        userId: request.userId!,
        company: payload.company,
        role: payload.role,
        jobUrl: payload.jobUrl || null,
        source: payload.source,
        autofillPayload: payload.suggestions
      }
    });

    response.status(201).json({ application });
  })
);

export const autofillRouter = router;
