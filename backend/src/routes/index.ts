import { Router } from "express";

import { applicationRouter } from "../modules/application/routes.js";
import { authRouter } from "../modules/auth/routes.js";
import { autofillRouter } from "../modules/autofill/routes.js";
import { experienceRouter } from "../modules/experience/routes.js";
import { jobsRouter } from "../modules/jobs/routes.js";
import { profileRouter } from "../modules/profile/routes.js";
import { storyRouter } from "../modules/story/routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "hiremeplz-backend",
    time: new Date().toISOString()
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/experiences", experienceRouter);
apiRouter.use("/stories", storyRouter);
apiRouter.use("/applications", applicationRouter);
apiRouter.use("/autofill", autofillRouter);
apiRouter.use("/jobs", jobsRouter);
