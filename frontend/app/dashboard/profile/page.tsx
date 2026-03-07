"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "../../../components/auth-gate";
import { apiRequest, splitCommaText } from "../../../lib/api";
import type { Education, UserProfile } from "../../../types";

const emptyProfile: UserProfile = {
  preferredRoles: [],
  preferredCities: [],
  skills: [],
};

export default function ProfilePage() {
  return (
    <AuthGate>{(token) => <ProfileContent token={token} />}</AuthGate>
  );
}

function ProfileContent({ token }: { token: string }) {
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [educations, setEducations] = useState<Education[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [editing, setEditing] = useState(false);

  const roleText = useMemo(
    () => profile.preferredRoles.join(", "),
    [profile.preferredRoles]
  );
  const cityText = useMemo(
    () => profile.preferredCities.join(", "),
    [profile.preferredCities]
  );

  useEffect(() => {
    apiRequest<{ profile: UserProfile | null; educations: Education[] }>(
      "/profile",
      { token }
    )
      .then((data) => {
        setProfile(data.profile || emptyProfile);
        setEducations(data.educations);
      })
      .catch((error) => setMessage(error.message));
  }, [token]);

  async function saveProfile() {
    setSaving(true);
    try {
      const payload = {
        ...profile,
        preferredRoles: splitCommaText(roleText),
        preferredCities: splitCommaText(cityText),
      };
      const data = await apiRequest<{ profile: UserProfile }>("/profile", {
        method: "PUT",
        token,
        body: payload,
      });
      setProfile(data.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addSkill() {
    const skill = skillInput.trim();
    if (skill && !profile.skills.includes(skill)) {
      setProfile({ ...profile, skills: [...profile.skills, skill] });
      setSkillInput("");
    }
  }

  function removeSkill(skill: string) {
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skill),
    });
  }

  async function addEducation() {
    try {
      const data = await apiRequest<{ education: Education }>(
        "/profile/educations",
        {
          method: "POST",
          token,
          body: {
            school: "University of Toronto",
            degree: "MEng",
            fieldOfStudy: "ECE",
            description: "Edit this education record.",
          },
        }
      );
      setEducations((current) => [data.education, ...current]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Create failed");
    }
  }

  if (!editing) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700"
          >
            Edit
          </button>
        </div>

        {message && (
          <p className="text-red-600 text-sm mb-4">{message}</p>
        )}

        <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["fullName", "Full Name"],
                ["phone", "Phone"],
                ["location", "City / Region"],
                ["school", "School"],
                ["degree", "Degree"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-sm mt-1">
                  {(profile[field] as string) || (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </p>
              </div>
            ))}
            <div className="col-span-2">
              <p className="text-sm font-medium text-gray-500">Summary</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">
                {profile.summary || (
                  <span className="text-gray-400 italic">Not set</span>
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Links</h2>
          <div className="grid grid-cols-1 gap-3">
            {(
              [
                ["linkedinUrl", "LinkedIn"],
                ["githubUrl", "GitHub"],
                ["portfolioUrl", "Portfolio"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-sm mt-1">
                  {(profile[field] as string) ? (
                    <a
                      href={profile[field] as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {profile[field] as string}
                    </a>
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Visa / Work Authorization
          </h2>
          <p className="text-sm">
            {profile.visaStatus || (
              <span className="text-gray-400 italic">Not set</span>
            )}
          </p>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Skills</h2>
          {profile.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic">No skills added</p>
          )}
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4">Preferences</h2>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Target Roles</p>
              <p className="text-sm mt-1">
                {profile.preferredRoles.length > 0
                  ? profile.preferredRoles.join(", ")
                  : <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Target Cities</p>
              <p className="text-sm mt-1">
                {profile.preferredCities.length > 0
                  ? profile.preferredCities.join(", ")
                  : <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Education</h2>
          {educations.length === 0 ? (
            <p className="text-gray-400 text-sm italic">
              No education records yet.
            </p>
          ) : (
            <div className="space-y-3">
              {educations.map((edu) => (
                <div key={edu.id} className="border rounded-lg p-4">
                  <p className="font-medium">
                    {edu.school} / {edu.degree}
                  </p>
                  <p className="text-sm text-gray-500">
                    {edu.fieldOfStudy || "No major provided"}
                  </p>
                  <p className="text-sm text-gray-400">
                    {edu.description || "No description"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await saveProfile();
              setEditing(false);
            }}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {message && (
        <p className="text-red-600 text-sm mb-4">{message}</p>
      )}

      <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ["fullName", "Full Name"],
              ["phone", "Phone"],
              ["location", "City / Region"],
              ["school", "School"],
              ["degree", "Degree"],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type="text"
                value={(profile[field] as string) || ""}
                onChange={(e) =>
                  setProfile({ ...profile, [field]: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Summary</label>
            <textarea
              value={profile.summary || ""}
              onChange={(e) =>
                setProfile({ ...profile, summary: e.target.value })
              }
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Links</h2>
        <div className="grid grid-cols-1 gap-4">
          {(
            [
              ["linkedinUrl", "LinkedIn URL"],
              ["githubUrl", "GitHub URL"],
              ["portfolioUrl", "Portfolio URL"],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type="url"
                value={(profile[field] as string) || ""}
                onChange={(e) =>
                  setProfile({ ...profile, [field]: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">
          Visa / Work Authorization
        </h2>
        <input
          type="text"
          value={profile.visaStatus || ""}
          onChange={(e) =>
            setProfile({ ...profile, visaStatus: e.target.value })
          }
          placeholder="e.g. Citizen, Work Visa, Student OPT"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Skills</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && (e.preventDefault(), addSkill())
            }
            placeholder="Add a skill (e.g. Python, React)"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            onClick={addSkill}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                className="text-blue-600 hover:text-blue-900"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Preferences</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Target roles (comma separated)
            </label>
            <input
              type="text"
              defaultValue={roleText}
              onBlur={(e) =>
                setProfile({
                  ...profile,
                  preferredRoles: splitCommaText(e.target.value),
                })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Target cities (comma separated)
            </label>
            <input
              type="text"
              defaultValue={cityText}
              onBlur={(e) =>
                setProfile({
                  ...profile,
                  preferredCities: splitCommaText(e.target.value),
                })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Education</h2>
          <button
            onClick={addEducation}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
          >
            + Add Education
          </button>
        </div>
        {educations.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No education records yet. Add at least one to improve autofill
            quality.
          </p>
        ) : (
          <div className="space-y-3">
            {educations.map((edu) => (
              <div key={edu.id} className="border rounded-lg p-4">
                <p className="font-medium">
                  {edu.school} / {edu.degree}
                </p>
                <p className="text-sm text-gray-500">
                  {edu.fieldOfStudy || "No major provided"}
                </p>
                <p className="text-sm text-gray-400">
                  {edu.description || "No description"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
