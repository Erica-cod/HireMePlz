"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AuthGate } from "../../components/auth-gate";
import { apiRequest } from "../../lib/api";
import type { Application } from "../../types";

export default function DashboardPage() {
  return (
    <AuthGate>
      {(token) => <DashboardContent token={token} />}
    </AuthGate>
  );
}

function DashboardContent({ token }: { token: string }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    apiRequest<{
      applications: Application[];
      stats: { total: number; byStatus: Record<string, number> };
    }>("/applications", { token })
      .then((data) => {
        setApplications(data.applications);
        setStats(data.stats.byStatus);
      })
      .catch(() => {});
  }, [token]);

  const cards = [
    { label: "Applications", value: applications.length },
    { label: "Applied", value: stats["applied"] ?? 0 },
    { label: "Interviewing", value: stats["interviewing"] ?? 0 },
    { label: "Offers", value: stats["offer"] ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border bg-white p-6 shadow-sm"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Applications</h2>
        {applications.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No applications yet. Install the Chrome extension and start
            applying!
          </p>
        ) : (
          <div className="space-y-3">
            {applications.slice(0, 5).map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between border-b pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {app.company} / {app.role}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(app.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
