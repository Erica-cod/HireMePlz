"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

import { AuthGate } from "../../../components/auth-gate";
import { DashboardLayout } from "../../../components/dashboard-layout";
import { apiRequest, splitCommaText } from "../../../lib/api";
import type { Story } from "../../../types";

const categories = [
  "challenge",
  "leadership",
  "teamwork",
  "project",
  "why_company",
  "behavioral",
  "general"
];

export default function StoriesPage() {
  return (
    <DashboardLayout
      title="Story Library"
      description="Long-form answer generation prioritizes relevant content from this library."
    >
      <AuthGate>{(token) => <StoriesContent token={token} />}</AuthGate>
    </DashboardLayout>
  );
}

function StoriesContent({ token }: { token: string }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "project",
    promptTags: "",
    situation: "",
    task: "",
    action: "",
    result: ""
  });

  function loadData() {
    apiRequest<{ stories: Story[] }>("/stories", { token })
      .then((data) => setStories(data.stories))
      .catch((error) => setMessage(error.message));
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function createStory() {
    try {
      await apiRequest("/stories", {
        method: "POST",
        token,
        body: {
          ...form,
          promptTags: splitCommaText(form.promptTags)
        }
      });
      setForm({
        title: "",
        category: "project",
        promptTags: "",
        situation: "",
        task: "",
        action: "",
        result: ""
      });
      setMessage("Story saved");
      loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  return (
    <div className="grid two">
      <section className="card stack">
        <h2>Add Story</h2>
        <input
          className="input"
          placeholder="Title"
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />
        <select
          className="select"
          value={form.category}
          onChange={(event) =>
            setForm((current) => ({ ...current, category: event.target.value }))
          }
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Tags, separated by commas"
          value={form.promptTags}
          onChange={(event) =>
            setForm((current) => ({ ...current, promptTags: event.target.value }))
          }
        />
        <textarea
          className="textarea"
          placeholder="Situation"
          value={form.situation}
          onChange={(event) =>
            setForm((current) => ({ ...current, situation: event.target.value }))
          }
        />
        <textarea
          className="textarea"
          placeholder="Task"
          value={form.task}
          onChange={(event) =>
            setForm((current) => ({ ...current, task: event.target.value }))
          }
        />
        <textarea
          className="textarea"
          placeholder="Action"
          value={form.action}
          onChange={(event) =>
            setForm((current) => ({ ...current, action: event.target.value }))
          }
        />
        <textarea
          className="textarea"
          placeholder="Result"
          value={form.result}
          onChange={(event) =>
            setForm((current) => ({ ...current, result: event.target.value }))
          }
        />
        <button className="button primary" onClick={createStory}>
          Save story
        </button>
        {message ? <p>{message}</p> : null}
      </section>

      <section className="card stack">
        <h2>Saved Stories</h2>
        <div className="list">
          {stories.map((story) => (
            <div className="listItem" key={story.id}>
              <strong>
                {story.title} / {story.category}
              </strong>
              <p className="muted">Tags: {story.promptTags.join(", ") || "Not provided"}</p>
              <p>{story.situation}</p>
            </div>
          ))}
          {stories.length === 0 ? (
            <p className="muted">It is recommended to prepare at least challenge, project, and leadership stories.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
