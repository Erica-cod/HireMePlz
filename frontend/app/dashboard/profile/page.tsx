"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";

import { AuthGate } from "../../../components/auth-gate";
import { DashboardLayout } from "../../../components/dashboard-layout";
import { apiRequest, splitCommaText } from "../../../lib/api";
import type { Education, UserProfile } from "../../../types";

const emptyProfile: UserProfile = {
  preferredRoles: [],
  preferredCities: [],
  skills: []
};

export default function ProfilePage() {
  return (
    <DashboardLayout
      title="Profile"
      description="This structured data is used by the backend for field matching and job recommendations."
    >
      <AuthGate>{(token) => <ProfileContent token={token} />}</AuthGate>
    </DashboardLayout>
  );
}

function ProfileContent({ token }: { token: string }) {
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [educations, setEducations] = useState<Education[]>([]);
  const [message, setMessage] = useState("");

  const skillText = useMemo(() => profile.skills.join(", "), [profile.skills]);
  const roleText = useMemo(
    () => profile.preferredRoles.join(", "),
    [profile.preferredRoles]
  );
  const cityText = useMemo(
    () => profile.preferredCities.join(", "),
    [profile.preferredCities]
  );

  useEffect(() => {
    apiRequest<{ profile: UserProfile | null; educations: Education[] }>("/profile", {
      token
    })
      .then((data) => {
        setProfile(data.profile || emptyProfile);
        setEducations(data.educations);
      })
      .catch((error) => setMessage(error.message));
  }, [token]);

  async function saveProfile() {
    try {
      const payload = {
        ...profile,
        preferredRoles: splitCommaText(roleText),
        preferredCities: splitCommaText(cityText),
        skills: splitCommaText(skillText)
      };
      const data = await apiRequest<{ profile: UserProfile }>("/profile", {
        method: "PUT",
        token,
        body: payload
      });
      setProfile(data.profile);
      setMessage("Profile saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function addEducation() {
    try {
      const data = await apiRequest<{ education: Education }>("/profile/educations", {
        method: "POST",
        token,
        body: {
          school: "University of Toronto",
          degree: "MEng",
          fieldOfStudy: "ECE",
          description: "Please continue editing this education record from backend or a dedicated page."
        }
      });
      setEducations((current) => [data.education, ...current]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Create failed");
    }
  }

  return (
    <div className="grid two">
      <section className="card stack">
        <h2>Basic Information</h2>
        <input
          className="input"
          placeholder="Full name"
          value={profile.fullName || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, fullName: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Phone"
          value={profile.phone || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, phone: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="City / Region"
          value={profile.location || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, location: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="School"
          value={profile.school || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, school: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Degree"
          value={profile.degree || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, degree: event.target.value }))
          }
        />
        <textarea
          className="textarea"
          placeholder="Summary"
          value={profile.summary || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, summary: event.target.value }))
          }
        />
        <button className="button primary" onClick={saveProfile}>
          Save profile
        </button>
        {message ? <p>{message}</p> : null}
      </section>

      <section className="card stack">
        <h2>Preferences and Links</h2>
        <input
          className="input"
          placeholder="LinkedIn URL"
          value={profile.linkedinUrl || ""}
          onChange={(event) =>
            setProfile((current) => ({
              ...current,
              linkedinUrl: event.target.value
            }))
          }
        />
        <input
          className="input"
          placeholder="GitHub URL"
          value={profile.githubUrl || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, githubUrl: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Portfolio URL"
          value={profile.portfolioUrl || ""}
          onChange={(event) =>
            setProfile((current) => ({
              ...current,
              portfolioUrl: event.target.value
            }))
          }
        />
        <input
          className="input"
          placeholder="Visa / Work Authorization"
          value={profile.visaStatus || ""}
          onChange={(event) =>
            setProfile((current) => ({ ...current, visaStatus: event.target.value }))
          }
        />
        <input
          className="input"
          placeholder="Target roles, separated by commas"
          defaultValue={roleText}
          onBlur={(event) =>
            setProfile((current) => ({
              ...current,
              preferredRoles: splitCommaText(event.target.value)
            }))
          }
        />
        <input
          className="input"
          placeholder="Target cities, separated by commas"
          defaultValue={cityText}
          onBlur={(event) =>
            setProfile((current) => ({
              ...current,
              preferredCities: splitCommaText(event.target.value)
            }))
          }
        />
        <input
          className="input"
          placeholder="Skills, separated by commas"
          defaultValue={skillText}
          onBlur={(event) =>
            setProfile((current) => ({
              ...current,
              skills: splitCommaText(event.target.value)
            }))
          }
        />
      </section>

      <section className="card stack" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h2>Education</h2>
          <button className="button secondary" onClick={addEducation}>
            Add sample education
          </button>
        </div>
        <div className="list">
          {educations.map((education) => (
            <div className="listItem" key={education.id}>
              <strong>
                {education.school} / {education.degree}
              </strong>
              <p className="muted">{education.fieldOfStudy || "No major provided"}</p>
              <p className="muted">{education.description || "No description"}</p>
            </div>
          ))}
          {educations.length === 0 ? (
            <p className="muted">No education records yet. Add at least one to improve autofill quality.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
