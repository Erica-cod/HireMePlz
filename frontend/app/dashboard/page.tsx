"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

import { AuthGate } from "../../components/auth-gate";
import { DashboardLayout } from "../../components/dashboard-layout";
import { apiRequest } from "../../lib/api";
import type { JobMatch } from "../../types";

export default function DashboardPage() {
  return (
    <DashboardLayout
      title="Dashboard Overview"
      description="Quickly check profile readiness, recommended jobs, and extension setup instructions."
    >
      <AuthGate>
        {(token) => <DashboardContent token={token} />}
      </AuthGate>
    </DashboardLayout>
  );
}

function DashboardContent({ token }: { token: string }) {
  const [matches, setMatches] = useState<JobMatch[]>([]);

  useEffect(() => {
    apiRequest<{ matches: JobMatch[] }>("/jobs/recommendations", {
      token
    })
      .then((data) => setMatches(data.matches))
      .catch(() => setMatches([]));
  }, [token]);

  return (
    <div className="grid two">
      <section className="card stack">
        <h2>Extension Setup Steps</h2>
        <ol className="muted">
          <li>Sign in first on the auth page.</li>
          <li>Copy the local token from browser storage.</li>
          <li>Load `extension/manifest.json` into Chrome as an unpacked extension.</li>
          <li>Enter API URL and token on an application page, then scan fields.</li>
        </ol>
      </section>

      <section className="card stack">
        <h2>Recommended Jobs</h2>
        <div className="list">
          {matches.length === 0 ? (
            <p className="muted">No recommendations yet. Run the worker or complete profile data and try again.</p>
          ) : (
            matches.map((match) => (
              <div className="listItem" key={match.id}>
                <strong>
                  {match.job.company} / {match.job.title}
                </strong>
                <p className="muted">Location: {match.job.location || "Not provided"}</p>
                <p className="muted">Match score: {match.score.toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
