import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import {
  hashPassword,
  signToken,
  verifyPassword
} from "../../lib/security.js";
import {
  AuthenticatedRequest,
  requireAuth
} from "../../middleware/auth.js";

const router = Router();

const authSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

router.post("/register", async (request, response) => {
  const payload = authSchema.parse(request.body);

  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email }
  });

  if (existingUser) {
    response.status(409).json({ message: "This email is already registered" });
    return;
  }

  const passwordHash = await hashPassword(payload.password);
  const user = await prisma.user.create({
    data: {
      email: payload.email,
      passwordHash,
      profile: {
        create: {}
      }
    },
    include: {
      profile: true
    }
  });

  response.status(201).json({
    token: signToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      profile: user.profile
    }
  });
});

router.post("/login", async (request, response) => {
  const payload = authSchema.parse(request.body);

  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    include: { profile: true }
  });

  if (!user) {
    response.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const isValid = await verifyPassword(payload.password, user.passwordHash);
  if (!isValid) {
    response.status(401).json({ message: "Invalid email or password" });
    return;
  }

  response.json({
    token: signToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      profile: user.profile
    }
  });
});

router.get(
  "/me",
  requireAuth,
  async (request: AuthenticatedRequest, response) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      include: { profile: true }
    });

    if (!user) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    response.json({
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile
      }
    });
  }
);

export const authRouter = router;
