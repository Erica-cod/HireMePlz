"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AuthGate } from "../../../components/auth-gate";
import { apiRequest } from "../../../lib/api";
import type { JobMatch } from "../../../types";

export default function JobsPage() {
  return (
    <AuthGate>{(token) => <JobsContent token={token} />}</AuthGate>
  );
}

function JobsContent({ token }: { token: string }) {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ matches: JobMatch[] }>("/jobs/recommendations", { token })
      .then((data) => setMatches(data.matches))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <p className="text-gray-500">Loading job matches...</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Job Matches</h1>

      {matches.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-gray-500">
          <p>
            No matches yet. Jobs are fetched periodically and matched against
            your profile skills.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{match.job.title}</h3>
                  <p className="text-sm text-gray-600">
                    {match.job.company} &middot;{" "}
                    {match.job.location || "Remote"}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div
                    className={`text-2xl font-bold ${
                      match.score >= 0.75
                        ? "text-green-600"
                        : match.score >= 0.5
                        ? "text-yellow-600"
                        : "text-gray-400"
                    }`}
                  >
                    {Math.round(match.score * 100)}%
                  </div>
                  <p className="text-xs text-gray-400">match</p>
                </div>
              </div>
              {match.reasons.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {match.reasons.join(" · ")}
                </p>
              )}
              <div className="mt-3">
                <a
                  href={match.job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                >
                  View Job
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
