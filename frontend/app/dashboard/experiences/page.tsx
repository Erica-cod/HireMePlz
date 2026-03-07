"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

import { AuthGate } from "../../../components/auth-gate";
import { DashboardLayout } from "../../../components/dashboard-layout";
import { apiRequest, splitCommaText } from "../../../lib/api";
import type { Experience } from "../../../types";

export default function ExperiencesPage() {
  return (
    <DashboardLayout
      title="Experience Library"
      description="Project, internship, and work experience are used for both long-form answer generation and job matching."
    >
      <AuthGate>{(token) => <ExperiencesContent token={token} />}</AuthGate>
    </DashboardLayout>
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
    skills: ""
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
          skills: splitCommaText(form.skills)
        }
      });
      setForm({
        title: "",
        company: "",
        location: "",
        description: "",
        highlights: "",
        skills: ""
      });
      setMessage("Experience saved");
      loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  return (
    <div className="grid two">
      <section className="card stack">
        <h2>Add Experience</h2>
        <input
          className="input"
          placeholder="Title, e.g. Software Engineer Intern"
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Company"
          value={form.company}
          onChange={(event) =>
            setForm((current) => ({ ...current, company: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Location"
          value={form.location}
          onChange={(event) =>
            setForm((current) => ({ ...current, location: event.target.value }))
          }
        />
        <textarea
          className="textarea"
          placeholder="Describe what you did in this role"
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Highlights, separated by commas"
          value={form.highlights}
          onChange={(event) =>
            setForm((current) => ({ ...current, highlights: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Skills used, separated by commas"
          value={form.skills}
          onChange={(event) =>
            setForm((current) => ({ ...current, skills: event.target.value }))
          }
        />
        <button className="button primary" onClick={createExperience}>
          Save experience
        </button>
        {message ? <p>{message}</p> : null}
      </section>

      <section className="card stack">
        <h2>Saved Experiences</h2>
        <div className="list">
          {experiences.map((experience) => (
            <div className="listItem" key={experience.id}>
              <strong>
                {experience.title} {experience.company ? `@ ${experience.company}` : ""}
              </strong>
              <p className="muted">{experience.location || "Location not provided"}</p>
              <p>{experience.description}</p>
              <p className="muted">Skills: {experience.skills.join(", ") || "Not provided"}</p>
            </div>
          ))}
          {experiences.length === 0 ? (
            <p className="muted">No experiences yet. It is recommended to add at least 2 to 3 records.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
