"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AuthGate } from "../../../components/auth-gate";
import { apiRequest } from "../../../lib/api";
import { TagInput } from "../../../components/tag-input";
import type { Story } from "../../../types";

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
  const [formError, setFormError] = useState("");

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
      tags: [],
      content: "",
    });
    setIsNew(true);
  }

  function startEdit(story: Story) {
    setEditing({ ...story });
    setIsNew(false);
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.title?.trim() || !editing.content?.trim()) {
      setFormError("Please fill in Title and Content.");
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
                Title <span className="text-red-500">*</span>
              </label>
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
              tags={editing.tags || []}
              onChange={(tags) => setEditing({ ...editing, tags })}
              placeholder="e.g. leadership, react, team conflict"
            />
            <div>
              <label className="block text-sm font-medium mb-1">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={editing.content || ""}
                onChange={(e) =>
                  setEditing({ ...editing, content: e.target.value })
                }
                rows={8}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Write your story here. You can use any format (STAR, free-form, etc.)"
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
                <div className="min-w-0">
                  <h3 className="font-semibold">{story.title}</h3>
                  {story.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {story.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap line-clamp-4">
                    {story.content}
                  </p>
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
