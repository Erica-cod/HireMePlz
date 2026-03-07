"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

import { AuthGate } from "../../../components/auth-gate";
import { DashboardLayout } from "../../../components/dashboard-layout";
import { apiRequest } from "../../../lib/api";
import type { Application } from "../../../types";

const statusOptions = ["draft", "applied", "interviewing", "rejected", "offer"];

export default function ApplicationsPage() {
  return (
    <DashboardLayout
      title="Application Records"
      description="This page shows application records saved by the extension and lets you update status manually."
    >
      <AuthGate>{(token) => <ApplicationsContent token={token} />}</AuthGate>
    </DashboardLayout>
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
        body: { status }
      });
      loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  return (
    <div className="stack">
      <section className="card grid two">
        {statusOptions.map((status) => (
          <div className="listItem" key={status}>
            <strong>{status}</strong>
            <p className="muted">{stats[status] || 0}</p>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Application List</h2>
        <div className="list">
          {applications.map((application) => (
            <div className="listItem" key={application.id}>
              <strong>
                {application.company} / {application.role}
              </strong>
              <p className="muted">
                Last updated: {new Date(application.updatedAt).toLocaleString()}
              </p>
              <select
                className="select"
                value={application.status}
                onChange={(event) => updateStatus(application.id, event.target.value)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {applications.length === 0 ? (
            <p className="muted">Records will appear here after the extension saves an autofill session.</p>
          ) : null}
        </div>
        {message ? <p>{message}</p> : null}
      </section>
    </div>
  );
}
