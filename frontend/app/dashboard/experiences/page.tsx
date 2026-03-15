"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AuthGate } from "../../../components/auth-gate";
import { apiRequest } from "../../../lib/api";
import { TagInput } from "../../../components/tag-input";
import type { Experience } from "../../../types";

const emptyForm = {
  title: "",
  company: "",
  location: "",
  description: "",
  highlights: [] as string[],
  skills: [] as string[],
};

export default function ExperiencesPage() {
  return (
    <AuthGate>{(token) => <ExperiencesContent token={token} />}</AuthGate>
  );
}

function ExperiencesContent({ token }: { token: string }) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<
    | { mode: "new"; form: typeof emptyForm }
    | { mode: "edit"; id: string; form: typeof emptyForm }
    | null
  >(null);

  function loadData() {
    apiRequest<{ experiences: Experience[] }>("/experiences", { token })
      .then((data) => setExperiences(data.experiences))
      .catch((error) => setMessage(error.message));
  }

  useEffect(() => {
    loadData();
  }, [token]);

  function startNew() {
    setEditing({ mode: "new", form: { ...emptyForm } });
  }

  function startEdit(exp: Experience) {
    setEditing({
      mode: "edit",
      id: exp.id,
      form: {
        title: exp.title,
        company: exp.company || "",
        location: exp.location || "",
        description: exp.description || "",
        highlights: [...exp.highlights],
        skills: [...exp.skills],
      },
    });
  }

  const [formError, setFormError] = useState("");

  async function handleSave() {
    if (!editing) return;
    if (!editing.form.title.trim() || !editing.form.description.trim()) {
      setFormError("Please fill in Title and Description.");
      return;
    }
    setFormError("");
    try {
      const body = { ...editing.form };
      if (editing.mode === "new") {
        await apiRequest("/experiences", { method: "POST", token, body });
      } else {
        await apiRequest(`/experiences/${editing.id}`, {
          method: "PUT",
          token,
          body,
        });
      }
      setEditing(null);
      setMessage("Experience saved");
      loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this experience?")) return;
    try {
      await apiRequest(`/experiences/${id}`, { method: "DELETE", token });
      loadData();
    } catch {
      setMessage("Failed to delete");
    }
  }

  function updateForm(patch: Partial<typeof emptyForm>) {
    if (!editing) return;
    setEditing({ ...editing, form: { ...editing.form, ...patch } });
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Experience Library</h1>
        {!editing && (
          <button
            onClick={startNew}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700"
          >
            + Add Experience
          </button>
        )}
      </div>

      {message && <p className="text-sm text-blue-600 mb-4">{message}</p>}

      {editing && (
        <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editing.mode === "new" ? "New Experience" : "Edit Experience"}
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer Intern"
                  value={editing.form.title}
                  onChange={(e) => updateForm({ title: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Company <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editing.form.company}
                  onChange={(e) => updateForm({ company: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Location <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={editing.form.location}
                onChange={(e) => updateForm({ location: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editing.form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <TagInput
              label="Highlights"
              tags={editing.form.highlights}
              onChange={(highlights) => updateForm({ highlights })}
              placeholder="e.g. Reduced latency by 40%"
            />
            <TagInput
              label="Skills used"
              tags={editing.form.skills}
              onChange={(skills) => updateForm({ skills })}
              placeholder="e.g. Python, React"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => { setEditing(null); setFormError(""); }}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
              >
                Cancel
              </button>
              {formError && (
                <span className="text-red-500 text-sm">{formError}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {experiences.length === 0 && !editing ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-gray-500">
          <p>
            No experiences yet. Add 2-3 records to improve autofill quality.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {experiences
            .filter((exp) => !editing || editing.mode !== "edit" || editing.id !== exp.id)
            .map((exp) => (
            <div
              key={exp.id}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">
                    {exp.title}
                    {exp.company ? ` @ ${exp.company}` : ""}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {exp.location || "Location not provided"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {exp.description}
                  </p>
                  {exp.highlights.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Highlights: {exp.highlights.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Skills: {exp.skills.join(", ") || "Not provided"}
                  </p>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => startEdit(exp)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
