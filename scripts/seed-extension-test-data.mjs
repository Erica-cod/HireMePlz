#!/usr/bin/env node
/**
 * Seeds a test user + profile/education/experience/stories via the real backend API.
 * Intended when the stack runs in Docker (backend exposed on localhost:4000).
 * Extension steps are manual; see docs/extension-testing-guide.md for UI flow.
 *
 * Usage:
 *   node scripts/seed-extension-test-data.mjs
 *   BASE_URL=http://localhost:4000 EMAIL=you@x.test PASSWORD=secret123 node scripts/seed-extension-test-data.mjs
 */

const BASE_URL = (process.env.BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const EMAIL =
  process.env.EMAIL || `extension-mock-${Date.now()}@example.test`;
const PASSWORD = process.env.PASSWORD || "mockpass123";
const NAME = process.env.NAME || "Extension Mock User";

async function api(path, { method = "GET", token, body } = {}) {
  const url = `${BASE_URL}/api${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || text || res.statusText;
    throw new Error(`${method} ${path} -> ${res.status}: ${msg}`);
  }
  return json;
}

async function main() {
  console.log(`Backend: ${BASE_URL}`);
  const health = await api("/health");
  console.log("Health:", health.status || health);

  let token;
  try {
    const reg = await api("/auth/register", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD, name: NAME }
    });
    token = reg.token;
    console.log("Registered new user.");
  } catch (e) {
    if (!String(e.message).includes("409")) throw e;
    console.log("Email already registered, logging in...");
    const login = await api("/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: PASSWORD }
    });
    token = login.token;
  }

  await api("/profile", {
    method: "PUT",
    token,
    body: {
      fullName: NAME,
      phone: "+1 416 555 0100",
      location: "Toronto, ON",
      school: "University of Toronto",
      degree: "MEng",
      graduationYear: 2025,
      linkedinUrl: "https://linkedin.com/in/extension-mock",
      githubUrl: "https://github.com/extension-mock",
      portfolioUrl: "https://example.com/portfolio",
      visaStatus: "Work authorization — no sponsorship required",
      preferredRoles: ["Software Engineer", "Backend Engineer"],
      preferredCities: ["Toronto", "Remote"],
      skills: [
        "TypeScript",
        "Node.js",
        "PostgreSQL",
        "Redis",
        "System design"
      ],
      summary:
        "Backend-focused engineer; experience with APIs, caching, and performance work."
    }
  });
  console.log("Profile updated.");

  await api("/profile/educations", {
    method: "POST",
    token,
    body: {
      school: "University of Toronto",
      degree: "MEng",
      fieldOfStudy: "ECE",
      startDate: "2023-09-01T00:00:00.000Z",
      endDate: "2025-04-30T00:00:00.000Z",
      description: "Coursework in distributed systems and ML systems."
    }
  });
  console.log("Education added.");

  await api("/experiences", {
    method: "POST",
    token,
    body: {
      title: "Software Engineer Intern",
      company: "Tech Corp",
      location: "Toronto, ON",
      description:
        "Developed backend services using Node.js. Optimized API response times by 87%.",
      highlights: [
        "Reduced API latency by 87%",
        "Implemented Redis caching"
      ],
      skills: ["Node.js", "PostgreSQL", "Redis"],
      startDate: "2024-05-01T00:00:00.000Z",
      endDate: "2024-08-31T00:00:00.000Z"
    }
  });
  console.log("Experience added.");

  await api("/stories", {
    method: "POST",
    token,
    body: {
      title: "Optimized API Response Time by 87%",
      tags: ["performance", "backend", "leadership"],
      content:
        "During my internship at Tech Corp, our legacy API had response times exceeding 3 seconds. I profiled the database queries, identified N+1 issues, and implemented batch loading with Redis caching. Response time dropped from 3.2s to 400ms — an 87% improvement."
    }
  });
  console.log("Story 1 added.");

  await api("/stories", {
    method: "POST",
    token,
    body: {
      title: "Led On-Call Rotation and Incident Response",
      tags: ["reliability", "communication", "devops"],
      content:
        "Owned weekly on-call for a payments-adjacent service. Cut MTTR by adding runbooks, structured logging, and alert noise reduction. Coordinated with stakeholders during a 45-minute outage and shipped a hotfix with zero data loss."
    }
  });
  console.log("Story 2 added.");

  console.log("\n--- Use in Extension popup (or frontend /auth) ---");
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log("\nJWT (localStorage hiremeplz-token if you paste manually):");
  console.log(token);
  console.log("\nNext: open frontend /auth, sign in, or load extension and point API to this backend.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
