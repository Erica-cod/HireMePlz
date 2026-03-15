"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AuthGate } from "../../../../components/auth-gate";
import { apiRequest } from "../../../../lib/api";
import type { JobSubscription, JobIngestionRun } from "../../../../types";

export default function SubscriptionsPage() {
  return (
    <AuthGate>
      {(token) => <SubscriptionsContent token={token} />}
    </AuthGate>
  );
}

const SITE_OPTIONS = [
  "indeed",
  "linkedin",
  "glassdoor",
  "google",
  "zip_recruiter",
] as const;

const JOB_TYPE_OPTIONS = [
  { value: "fulltime", label: "Full-time" },
  { value: "parttime", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "contract", label: "Contract" },
] as const;

type FormData = {
  name: string;
  enabled: boolean;
  keywords: string;
  locations: string;
  isRemote: boolean | null;
  jobTypes: string[];
  sites: string[];
  countryIndeed: string;
  hoursOld: string;
  resultsWanted: string;
  runEveryMinutes: string;
};

const emptyForm: FormData = {
  name: "",
  enabled: true,
  keywords: "",
  locations: "",
  isRemote: null,
  jobTypes: [],
  sites: ["indeed"],
  countryIndeed: "USA",
  hoursOld: "72",
  resultsWanted: "30",
  runEveryMinutes: "60",
};

function subscriptionToForm(s: JobSubscription): FormData {
  return {
    name: s.name,
    enabled: s.enabled,
    keywords: s.keywords.join(", "),
    locations: s.locations.join(", "),
    isRemote: s.isRemote ?? null,
    jobTypes: s.jobTypes,
    sites: s.sites,
    countryIndeed: s.countryIndeed || "USA",
    hoursOld: s.hoursOld?.toString() || "",
    resultsWanted: s.resultsWanted.toString(),
    runEveryMinutes: s.runEveryMinutes.toString(),
  };
}

function formToPayload(form: FormData) {
  return {
    name: form.name.trim(),
    enabled: form.enabled,
    keywords: form.keywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    locations: form.locations
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    isRemote: form.isRemote,
    jobTypes: form.jobTypes,
    sites: form.sites,
    countryIndeed: form.countryIndeed || null,
    hoursOld: form.hoursOld ? Number(form.hoursOld) : null,
    resultsWanted: Number(form.resultsWanted) || 30,
    runEveryMinutes: Number(form.runEveryMinutes) || 60,
  };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: "bg-gray-100 text-gray-600",
    running: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.idle}`}
    >
      {status}
    </span>
  );
}

function SubscriptionForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  title,
}: {
  form: FormData;
  onChange: (f: FormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  title: string;
}) {
  const update = (partial: Partial<FormData>) =>
    onChange({ ...form, ...partial });

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Frontend Engineer Jobs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keywords (comma-separated)
          </label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={form.keywords}
            onChange={(e) => update({ keywords: e.target.value })}
            placeholder="e.g. react, frontend, typescript"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Locations (comma-separated, optional)
          </label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={form.locations}
            onChange={(e) => update({ locations: e.target.value })}
            placeholder="e.g. San Francisco, New York"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Sites
            </label>
            <div className="flex flex-wrap gap-2">
              {SITE_OPTIONS.map((site) => (
                <label key={site} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.sites.includes(site)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.sites, site]
                        : form.sites.filter((s) => s !== site);
                      update({ sites: next });
                    }}
                  />
                  {site}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Types
            </label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPE_OPTIONS.map((jt) => (
                <label key={jt.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.jobTypes.includes(jt.value)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.jobTypes, jt.value]
                        : form.jobTypes.filter((t) => t !== jt.value);
                      update({ jobTypes: next });
                    }}
                  />
                  {jt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remote
            </label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.isRemote === null ? "" : String(form.isRemote)}
              onChange={(e) => {
                const v = e.target.value;
                update({
                  isRemote: v === "" ? null : v === "true",
                });
              }}
            >
              <option value="">Any</option>
              <option value="true">Remote only</option>
              <option value="false">On-site only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country (Indeed)
            </label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.countryIndeed}
              onChange={(e) => update({ countryIndeed: e.target.value })}
              placeholder="USA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max hours old
            </label>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.hoursOld}
              onChange={(e) => update({ hoursOld: e.target.value })}
              placeholder="72"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Results wanted
            </label>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.resultsWanted}
              onChange={(e) => update({ resultsWanted: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Run every (min)
            </label>
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.runEveryMinutes}
              onChange={(e) => update({ runEveryMinutes: e.target.value })}
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RunHistory({
  runs,
  loading,
}: {
  runs: JobIngestionRun[];
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-gray-400">Loading runs...</p>;
  if (runs.length === 0)
    return <p className="text-sm text-gray-400">No runs yet.</p>;

  return (
    <div className="mt-3 rounded-lg border bg-gray-50 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-gray-100 text-gray-600">
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Started</th>
            <th className="px-3 py-2 text-right">Fetched</th>
            <th className="px-3 py-2 text-right">Inserted</th>
            <th className="px-3 py-2 text-right">Matched</th>
            <th className="px-3 py-2 text-left">Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                <StatusBadge status={run.status} />
              </td>
              <td className="px-3 py-2 text-gray-500">
                {timeAgo(run.startedAt)}
              </td>
              <td className="px-3 py-2 text-right">{run.fetchedCount}</td>
              <td className="px-3 py-2 text-right">{run.insertedCount}</td>
              <td className="px-3 py-2 text-right">{run.matchedCount}</td>
              <td className="px-3 py-2 text-red-500 truncate max-w-[200px]">
                {run.errorMessage || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubscriptionsContent({ token }: { token: string }) {
  const [subscriptions, setSubscriptions] = useState<JobSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [expandedRuns, setExpandedRuns] = useState<Record<string, JobIngestionRun[]>>({});
  const [loadingRuns, setLoadingRuns] = useState<Set<string>>(new Set());

  const fetchSubscriptions = useCallback(() => {
    setLoading(true);
    apiRequest<{ subscriptions: JobSubscription[] }>("/jobs/subscriptions", {
      token,
    })
      .then((data) => {
        setSubscriptions(data.subscriptions);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await apiRequest("/jobs/subscriptions", {
        token,
        method: "POST",
        body: formToPayload(form),
      });
      setMode("list");
      setForm(emptyForm);
      fetchSubscriptions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSubmitting(true);
    try {
      await apiRequest(`/jobs/subscriptions/${editingId}`, {
        token,
        method: "PUT",
        body: formToPayload(form),
      });
      setMode("list");
      setEditingId(null);
      setForm(emptyForm);
      fetchSubscriptions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this subscription?")) return;
    try {
      await apiRequest(`/jobs/subscriptions/${id}`, {
        token,
        method: "DELETE",
      });
      fetchSubscriptions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleBootstrap = async () => {
    setSubmitting(true);
    try {
      await apiRequest("/jobs/subscriptions/bootstrap", {
        token,
        method: "POST",
      });
      fetchSubscriptions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to bootstrap");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRuns = async (subId: string) => {
    if (expandedRuns[subId]) {
      const next = { ...expandedRuns };
      delete next[subId];
      setExpandedRuns(next);
      return;
    }
    setLoadingRuns((prev) => new Set(prev).add(subId));
    try {
      const data = await apiRequest<{ runs: JobIngestionRun[] }>(
        `/jobs/subscriptions/${subId}/runs`,
        { token }
      );
      setExpandedRuns((prev) => ({ ...prev, [subId]: data.runs }));
    } catch {
      /* ignore */
    } finally {
      setLoadingRuns((prev) => {
        const next = new Set(prev);
        next.delete(subId);
        return next;
      });
    }
  };

  if (mode === "create") {
    return (
      <div className="max-w-3xl">
        <SubscriptionForm
          form={form}
          onChange={setForm}
          onSubmit={handleCreate}
          onCancel={() => {
            setMode("list");
            setForm(emptyForm);
          }}
          submitting={submitting}
          title="New Subscription"
        />
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className="max-w-3xl">
        <SubscriptionForm
          form={form}
          onChange={setForm}
          onSubmit={handleUpdate}
          onCancel={() => {
            setMode("list");
            setEditingId(null);
            setForm(emptyForm);
          }}
          submitting={submitting}
          title="Edit Subscription"
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Job Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure what jobs to scrape and how often.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBootstrap}
            disabled={submitting}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Auto from Profile
          </button>
          <button
            onClick={() => {
              setForm(emptyForm);
              setMode("create");
            }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            + New
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4">
        <Link
          href="/dashboard/jobs"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Job Matches
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading subscriptions...</p>
      ) : subscriptions.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-gray-500">
          <p>
            No subscriptions yet. Create one or click &quot;Auto from
            Profile&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{sub.name}</h3>
                    <StatusBadge status={sub.lastStatus} />
                    {!sub.enabled && (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">
                        disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Keywords: {sub.keywords.join(", ")}
                  </p>
                  {sub.locations.length > 0 && (
                    <p className="text-sm text-gray-500">
                      Locations: {sub.locations.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Sites: {sub.sites.join(", ")} &middot; Every{" "}
                    {sub.runEveryMinutes}min &middot; Max{" "}
                    {sub.resultsWanted} results
                    {sub.lastRunAt && (
                      <> &middot; Last run: {timeAgo(sub.lastRunAt)}</>
                    )}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 ml-4">
                  <button
                    onClick={() => {
                      setEditingId(sub.id);
                      setForm(subscriptionToForm(sub));
                      setMode("edit");
                    }}
                    className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(sub.id)}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-2">
                <button
                  onClick={() => toggleRuns(sub.id)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {expandedRuns[sub.id] ? "Hide runs" : "Show run history"}
                </button>
                {(expandedRuns[sub.id] || loadingRuns.has(sub.id)) && (
                  <RunHistory
                    runs={expandedRuns[sub.id] || []}
                    loading={loadingRuns.has(sub.id)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
