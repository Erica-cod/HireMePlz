"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AuthGate } from "../../../components/auth-gate";
import { apiRequest, splitCommaText } from "../../../lib/api";
import type { Experience } from "../../../types";

export default function ExperiencesPage() {
  return (
    <AuthGate>{(token) => <ExperiencesContent token={token} />}</AuthGate>
  );
}

function ExperiencesContent({ token }: { token: string }) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    description: "",
    highlights: "",
    skills: "",
  });

  function loadData() {
    apiRequest<{ experiences: Experience[] }>("/experiences", { token })
      .then((data) => setExperiences(data.experiences))
      .catch((error) => setMessage(error.message));
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function createExperience() {
    try {
      await apiRequest("/experiences", {
        method: "POST",
        token,
        body: {
          ...form,
          highlights: splitCommaText(form.highlights),
          skills: splitCommaText(form.skills),
        },
      });
      setForm({
        title: "",
        company: "",
        location: "",
        description: "",
        highlights: "",
        skills: "",
      });
      setMessage("Experience saved");
      loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Experience Library</h1>

      {message && <p className="text-sm text-blue-600 mb-4">{message}</p>}

      <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Add Experience</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                placeholder="e.g. Software Engineer Intern"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) =>
                  setForm({ ...form, company: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) =>
                setForm({ ...form, location: e.target.value })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Highlights (comma separated)
            </label>
            <input
              type="text"
              value={form.highlights}
              onChange={(e) =>
                setForm({ ...form, highlights: e.target.value })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Skills used (comma separated)
            </label>
            <input
              type="text"
              value={form.skills}
              onChange={(e) =>
                setForm({ ...form, skills: e.target.value })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={createExperience}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700"
          >
            Save Experience
          </button>
        </div>
      </div>

      {experiences.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-gray-500">
          <p>No experiences yet. Add 2-3 records to improve autofill quality.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {experiences.map((exp) => (
            <div
              key={exp.id}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <h3 className="font-semibold">
                {exp.title}
                {exp.company ? ` @ ${exp.company}` : ""}
              </h3>
              <p className="text-sm text-gray-500">
                {exp.location || "Location not provided"}
              </p>
              <p className="text-sm text-gray-600 mt-1">{exp.description}</p>
              <p className="text-xs text-gray-400 mt-1">
                Skills: {exp.skills.join(", ") || "Not provided"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
