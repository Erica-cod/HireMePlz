"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AuthGate } from "../../../components/auth-gate";
import { apiRequest } from "../../../lib/api";
import { TagInput } from "../../../components/tag-input";
import type { Story } from "../../../types";

const CATEGORIES = [
  { value: "challenge", label: "Challenge / Difficulty" },
  { value: "leadership", label: "Leadership" },
  { value: "teamwork", label: "Teamwork / Collaboration" },
  { value: "project", label: "Project" },
  { value: "why_company", label: "Why This Company" },
  { value: "behavioral", label: "Behavioral" },
  { value: "general", label: "General" },
];

export default function StoriesPage() {
  return (
    <AuthGate>{(token) => <StoriesContent token={token} />}</AuthGate>
  );
}

function StoriesContent({ token }: { token: string }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Partial<Story> | null>(null);
  const [isNew, setIsNew] = useState(false);

  function loadData() {
    apiRequest<{ stories: Story[] }>("/stories", { token })
      .then((data) => setStories(data.stories))
      .catch((error) => setMessage(error.message));
  }

  useEffect(() => {
    loadData();
  }, [token]);

  function startNew() {
    setEditing({
      title: "",
      category: "project",
      promptTags: [],
      situation: "",
      task: "",
      action: "",
      result: "",
    });
    setIsNew(true);
  }

  function startEdit(story: Story) {
    setEditing({ ...story });
    setIsNew(false);
  }

  const [formError, setFormError] = useState("");

  async function handleSave() {
    if (!editing) return;
    if (
      !editing.title?.trim() ||
      !editing.situation?.trim() ||
      !editing.action?.trim() ||
      !editing.result?.trim()
    ) {
      setFormError("Please fill in Title, Situation, Action, and Result.");
      return;
    }
    setFormError("");
    try {
      if (isNew) {
        await apiRequest("/stories", {
          method: "POST",
          token,
          body: editing,
        });
      } else {
        await apiRequest(`/stories/${editing.id}`, {
          method: "PUT",
          token,
          body: editing,
        });
      }
      setEditing(null);
      setMessage("Story saved");
      loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this story?")) return;
    try {
      await apiRequest(`/stories/${id}`, { method: "DELETE", token });
      loadData();
    } catch {
      setMessage("Failed to delete");
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Story Library</h1>
        <button
          onClick={startNew}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700"
        >
          + Add Story
        </button>
      </div>

      {message && (
        <p className="text-sm text-blue-600 mb-4">{message}</p>
      )}

      {editing && (
        <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {isNew ? "New Story" : "Edit Story"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Category
              </label>
              <select
                value={editing.category || "project"}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={editing.title || ""}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <TagInput
              label="Tags"
              tags={editing.promptTags || []}
              onChange={(promptTags) => setEditing({ ...editing, promptTags })}
              placeholder="e.g. teamwork, leadership"
            />
            <div>
              <label className="block text-sm font-medium mb-1">
                Situation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editing.situation || ""}
                onChange={(e) =>
                  setEditing({ ...editing, situation: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Task <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={editing.task || ""}
                onChange={(e) =>
                  setEditing({ ...editing, task: e.target.value })
                }
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Action <span className="text-red-500">*</span></label>
              <textarea
                value={editing.action || ""}
                onChange={(e) =>
                  setEditing({ ...editing, action: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Result <span className="text-red-500">*</span></label>
              <textarea
                value={editing.result || ""}
                onChange={(e) =>
                  setEditing({ ...editing, result: e.target.value })
                }
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
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

      {stories.length === 0 && !editing ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm text-center text-gray-500">
          <p>
            No stories yet. Add your experiences so the LLM can use them to
            answer application questions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {stories
            .filter((story) => !editing || isNew || editing.id !== story.id)
            .map((story) => (
            <div
              key={story.id}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 mb-2">
                    {CATEGORIES.find((c) => c.value === story.category)
                      ?.label ?? story.category}
                  </span>
                  <h3 className="font-semibold">{story.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Tags: {story.promptTags.join(", ") || "None"}
                  </p>
                  <div className="text-sm text-gray-600 mt-2 space-y-1">
                    <p><span className="font-medium text-gray-700">Situation:</span> <span className="line-clamp-2">{story.situation}</span></p>
                    {story.task && <p><span className="font-medium text-gray-700">Task:</span> <span className="line-clamp-1">{story.task}</span></p>}
                    <p><span className="font-medium text-gray-700">Action:</span> <span className="line-clamp-2">{story.action}</span></p>
                    <p><span className="font-medium text-gray-700">Result:</span> <span className="line-clamp-1">{story.result}</span></p>
                  </div>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => startEdit(story)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(story.id)}
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
