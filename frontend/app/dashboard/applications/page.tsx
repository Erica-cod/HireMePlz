"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AuthGate } from "../../../components/auth-gate";
import { apiRequest } from "../../../lib/api";
import type { Application } from "../../../types";

const STATUS_OPTIONS = ["draft", "applied", "interviewing", "rejected", "offer"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  applied: "bg-blue-100 text-blue-800",
  interviewing: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  offer: "bg-green-100 text-green-800",
};

export default function ApplicationsPage() {
  return (
    <AuthGate>
      {(token) => <ApplicationsContent token={token} />}
    </AuthGate>
  );
}

function ApplicationsContent({ token }: { token: string }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");

  function loadData() {
    apiRequest<{
      applications: Application[];
      stats: { total: number; byStatus: Record<string, number> };
    }>("/applications", { token })
      .then((data) => {
        setApplications(data.applications);
        setStats(data.stats.byStatus);
      })
      .catch((error) => setMessage(error.message));
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function updateStatus(id: string, status: string) {
    try {
      await apiRequest(`/applications/${id}/status`, {
        method: "PATCH",
        token,
        body: { status },
      });
      loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Application History</h1>

      {message && <p className="text-red-600 text-sm mb-4">{message}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {STATUS_OPTIONS.map((status) => (
          <div
            key={status}
            className="rounded-xl border bg-white p-4 shadow-sm text-center"
          >
            <p className="text-2xl font-bold">{stats[status] || 0}</p>
            <p className="text-xs text-gray-500 capitalize">{status}</p>
          </div>
        ))}
      </div>

      {applications.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-gray-500">
          <p>
            No applications recorded yet. Use the Chrome extension to autofill
            applications — they will be tracked here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">
                    {app.company} / {app.role}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Updated {new Date(app.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <select
                  value={app.status}
                  onChange={(e) => updateStatus(app.id, e.target.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border-0 ${
                    STATUS_COLORS[app.status] || "bg-gray-100"
                  }`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
