import { spawn } from "node:child_process";

import { JobSite } from "@prisma/client";

import { workerEnv } from "../lib/env.js";

const supportedJobSpySites = new Set<JobSite>([
  JobSite.linkedin,
  JobSite.indeed,
  JobSite.glassdoor,
  JobSite.google,
  JobSite.zip_recruiter,
  JobSite.bayt,
  JobSite.bdjobs
]);

export type JobSpyJob = {
  externalId?: string | null;
  site?: JobSite | null;
  title: string;
  company: string;
  companyUrl?: string | null;
  jobUrl: string;
  description?: string | null;
  skills?: string[] | null;
  isRemote?: boolean | null;
  jobType?: string | null;
  jobLevel?: string | null;
  postedAt?: string | null;
  locationText?: string | null;
  location?: {
    country?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  salary?: {
    minAmount?: number | null;
    maxAmount?: number | null;
    currency?: string | null;
    interval?: string | null;
  } | null;
  rawPayload?: unknown;
};

export type FetchJobSpyInput = {
  keyword: string;
  locations: string[];
  isRemote: boolean | null;
  jobTypes: string[];
  sites: JobSite[];
  countryIndeed: string | null;
  hoursOld: number | null;
  resultsWanted: number;
  userId: string;
  subscriptionId: string;
};

type JobSpyCommandResponse = {
  jobs?: JobSpyJob[];
  meta?: Record<string, unknown>;
};

function getSupportedSites(sites: JobSite[]) {
  return sites.filter((site) => supportedJobSpySites.has(site));
}

export async function fetchJobsWithJobSpy(input: FetchJobSpyInput) {
  const supportedSites = getSupportedSites(input.sites);
  const skippedSites = input.sites.filter((site) => !supportedJobSpySites.has(site));

  if (!supportedSites.length) {
    return {
      jobs: [] as JobSpyJob[],
      meta: {
        reason: "no_supported_jobspy_sites",
        skippedSites
      }
    };
  }

  if (!workerEnv.jobspyFetchCommand) {
    return {
      jobs: [] as JobSpyJob[],
      meta: {
        reason: "jobspy_fetch_command_missing",
        supportedSites,
        skippedSites
      }
    };
  }

  const payload = {
    ...input,
    sites: supportedSites
  };

  const commandResult = await runJobSpyCommand(payload);

  return {
    jobs: Array.isArray(commandResult.jobs) ? commandResult.jobs : [],
    meta: {
      supportedSites,
      skippedSites,
      ...(commandResult.meta || {})
    }
  };
}

function runJobSpyCommand(input: FetchJobSpyInput & { sites: JobSite[] }) {
  return new Promise<JobSpyCommandResponse>((resolve, reject) => {
    const child = spawn(workerEnv.jobspyFetchCommand, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `JobSpy command exited with non-zero status code: ${code ?? "unknown"}`
          )
        );
        return;
      }

      const normalizedOutput = stdout.trim();
      if (!normalizedOutput) {
        resolve({ jobs: [], meta: { reason: "empty_jobspy_output" } });
        return;
      }

      try {
        resolve(JSON.parse(normalizedOutput) as JobSpyCommandResponse);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse JobSpy command output as JSON: ${
              error instanceof Error ? error.message : "unknown error"
            }`
          )
        );
      }
    });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}
