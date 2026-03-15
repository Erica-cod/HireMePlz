"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "../../../components/auth-gate";
import { apiRequest } from "../../../lib/api";
import type { JobMatch } from "../../../types";

export default function JobsPage() {
  return (
    <AuthGate>{(token) => <JobsContent token={token} />}</AuthGate>
  );
}

function formatSalary(job: JobMatch["job"]) {
  if (!job.salaryMin && !job.salaryMax) return null;
  const currency = job.salaryCurrency || "USD";
  const interval = job.salaryInterval || "yearly";
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

  if (job.salaryMin && job.salaryMax) {
    return `${currency} ${fmt(job.salaryMin)}–${fmt(job.salaryMax)}/${interval}`;
  }
  return `${currency} ${fmt(job.salaryMin || job.salaryMax!)}+/${interval}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function JobCard({
  match,
  onDismiss,
}: {
  match: JobMatch;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { job } = match;
  const salary = formatSalary(job);

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg leading-none"
        title="Dismiss"
      >
        &times;
      </button>

      <div className="flex items-start justify-between pr-6">
        <div className="min-w-0">
          <h3 className="font-semibold text-base truncate">{job.title}</h3>
          <p className="text-sm text-gray-600">
            {job.company}
            {job.location && <> &middot; {job.location}</>}
            {job.isRemote && (
              <span className="ml-1 inline-block rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                Remote
              </span>
            )}
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

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {job.jobType && (
          <span className="rounded bg-gray-100 px-2 py-0.5">{job.jobType}</span>
        )}
        {job.jobLevel && (
          <span className="rounded bg-gray-100 px-2 py-0.5">{job.jobLevel}</span>
        )}
        {salary && (
          <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">
            {salary}
          </span>
        )}
        {job.postedAt && (
          <span>{timeAgo(job.postedAt)}</span>
        )}
        {job.sourceSite && (
          <span className="text-gray-400">via {job.sourceSite}</span>
        )}
      </div>

      {job.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {job.skills.slice(0, 8).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
            >
              {skill}
            </span>
          ))}
          {job.skills.length > 8 && (
            <span className="text-xs text-gray-400">
              +{job.skills.length - 8} more
            </span>
          )}
        </div>
      )}

      {match.reasons.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {match.reasons.join(" · ")}
        </p>
      )}

      {job.description && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {expanded ? "Hide description" : "Show description"}
          </button>
          {expanded && (
            <p className="mt-1 text-sm text-gray-600 whitespace-pre-line line-clamp-6">
              {job.description}
            </p>
          )}
        </div>
      )}

      <div className="mt-3">
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
        >
          Apply
        </a>
      </div>
    </div>
  );
}

function JobsContent({ token }: { token: string }) {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMatches = () => {
    setLoading(true);
    setError("");
    apiRequest<{ matches: JobMatch[] }>("/jobs/recommendations", { token })
      .then((data) => setMatches(data.matches))
      .catch((err) => setError(err.message || "Failed to load recommendations"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMatches();
  }, [token]);

  const visible = matches.filter((m) => !dismissed.has(m.id));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Job Matches</h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/jobs/subscriptions"
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Manage Subscriptions
          </Link>
          <button
            onClick={fetchMatches}
            disabled={loading}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && visible.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-gray-500">
          <p>
            No matches yet. Jobs are fetched periodically and matched against
            your profile skills.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((match) => (
            <JobCard
              key={match.id}
              match={match}
              onDismiss={() =>
                setDismissed((prev) => new Set(prev).add(match.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
