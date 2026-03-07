"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

import { AuthGate } from "../../../../components/auth-gate";
import { apiRequest } from "../../../../lib/api";
import type { AnswerMemory } from "../../../../types";

export default function AnswerMemoryPage() {
  return (
    <AuthGate>{(token) => <AnswerMemoryContent token={token} />}</AuthGate>
  );
}

function AnswerMemoryContent({ token }: { token: string }) {
  const [memories, setMemories] = useState<AnswerMemory[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState("");

  function loadData(nextSearch = search) {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    }

    apiRequest<{ memories: AnswerMemory[] }>(
      `/answer-memory?${params.toString()}`,
      { token }
    )
      .then((data) => setMemories(data.memories))
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "Failed to load")
      );
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function handleDelete(memoryId: string) {
    if (!confirm("Delete this cached answer?")) return;
    try {
      await apiRequest(`/answer-memory/${memoryId}`, {
        method: "DELETE",
        token
      });
      setMemories((current) => current.filter((item) => item.id !== memoryId));
      setMessage("Cached answer deleted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function startEdit(memory: AnswerMemory) {
    setEditingId(memory.id);
    setDraftAnswer(memory.answer);
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftAnswer("");
  }

  async function handleSave(memoryId: string) {
    if (!draftAnswer.trim()) {
      setMessage("Answer cannot be empty");
      return;
    }

    try {
      const data = await apiRequest<{ memory: AnswerMemory }>(
        `/answer-memory/${memoryId}`,
        {
          method: "PUT",
          token,
          body: { answer: draftAnswer.trim() }
        }
      );
      setMemories((current) =>
        current.map((item) => (item.id === memoryId ? data.memory : item))
      );
      setMessage("Cached answer updated");
      cancelEdit();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function handleClearAll() {
    if (!confirm("Delete all cached answers?")) return;
    try {
      const data = await apiRequest<{ deletedCount: number }>("/answer-memory", {
        method: "DELETE",
        token
      });
      setMemories([]);
      setMessage(`Deleted ${data.deletedCount} cached answers`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Answer Memory</h1>
        <button
          onClick={handleClearAll}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          Clear All
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={search}
          placeholder="Search by question text"
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <button
          onClick={() => loadData(search)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
      </div>

      {message && <p className="mb-4 text-sm text-blue-600">{message}</p>}

      {memories.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-center text-gray-500 shadow-sm">
          No cached answers found.
        </div>
      ) : (
        <div className="space-y-4">
          {memories.map((memory) => (
            <div key={memory.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Last used: {new Date(memory.lastUsedAt).toLocaleString()} · Hits:{" "}
                  {memory.hitCount}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => startEdit(memory)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(memory.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mb-2 text-sm font-medium text-gray-900">{memory.question}</p>
              {editingId === memory.id ? (
                <div className="mb-2">
                  <textarea
                    value={draftAnswer}
                    onChange={(event) => setDraftAnswer(event.target.value)}
                    rows={6}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleSave(memory.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mb-2 whitespace-pre-wrap text-sm text-gray-700">
                  {memory.answer}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Context: role="{memory.roleKey || "any"}" · company="
                {memory.companyKey || "any"}"
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
