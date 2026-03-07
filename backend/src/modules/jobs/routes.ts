import { Router } from "express";

import { prisma } from "../../lib/prisma.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";

const router = Router();

router.get(
  "/recommendations",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const matches = await prisma.jobMatch.findMany({
      where: { userId: request.userId },
      include: { job: true },
      orderBy: { score: "desc" },
      take: 20
    });

    response.json({ matches });
  })
);

export const jobsRouter = router;
