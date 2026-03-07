import { prisma } from "./lib/prisma.js";
import { seedJobsAndMatches } from "./jobs/fetchJobs.js";

const POLL_INTERVAL_MS = 10 * 60 * 1000;

async function runOnce() {
  await seedJobsAndMatches();
  console.log("HireMePlz worker completed one round of job fetching and matching.");
}

async function main() {
  await runOnce();
  setInterval(() => {
    void runOnce().catch((error) => {
      console.error("Worker scheduled task failed", error);
    });
  }, POLL_INTERVAL_MS);
}

void main().catch(async (error) => {
  console.error("Worker startup failed", error);
  await prisma.$disconnect();
  process.exit(1);
});
