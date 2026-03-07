import { collectPageFields, writeValue } from "./lib/detectors";
import { matchFields, type MatchResult } from "./lib/matcher";

// ============ MOCK MODE ============
const MOCK_MODE = true;

const MOCK_PROFILE: Record<string, unknown> = {
  first_name: "Keyin",
  last_name: "Liang",
  email: "keryn.liang@mail.utoronto.ca",
  phone: "647-555-1234",
  city: "Toronto",
  state: "Ontario",
  country: "Canada",
  zip_code: "M5S 1A1",
  linkedin_url: "https://linkedin.com/in/keyin-liang",
  github_url: "https://github.com/keryn",
  website_url: "https://keyin.dev",
  work_authorization: "Yes",
  needs_sponsorship: "Yes",
  immigration_status: "Study Permit",
  willing_to_relocate: "Yes",
  open_to_remote: "Yes",
  over_18: "Yes",
  previously_worked: "No",
  consent_background_check: "Yes",
  consent_drug_test: "Yes",
  no_noncompete: "No",
  notice_period: "2 weeks",
  referral_source: "LinkedIn",
  salary_expectation: "80000",
  start_date: "2026-07-01",
  gender: "Prefer not to say",
  pronouns: "He/Him",
  veteran_status: "No",
  disability_status: "No",
  ethnicity: "Prefer not to say",
  education: [
    {
      school: "University of Toronto",
      degree: "Master",
      major: "Electrical and Computer Engineering",
      gpa: "3.9",
      end_date: "2026-06",
    },
  ],
  experience: [{ company: "Tech Corp", title: "Software Engineer Intern" }],
};
// ===================================

let matchResults: MatchResult[] = [];

function isApplicationPage(): boolean {
  const url = window.location.href.toLowerCase();
  const patterns = [
    "greenhouse.io",
    "lever.co",
    "workday.com",
    "myworkdayjobs.com",
    "apply",
    "application",
    "career",
  ];
  return patterns.some((p) => url.includes(p));
}

async function init(): Promise<void> {
  let profileData: Record<string, unknown>;

  if (MOCK_MODE) {
    profileData = MOCK_PROFILE;
  } else {
    if (!isApplicationPage()) return;

    const apiUrl = await getStorageValue(
      "hiremeplz-api-url",
      "http://localhost:4000"
    );
    const token = await getStorageValue("hiremeplz-token");
    if (!token) return;

    try {
      const res = await fetch(`${apiUrl}/api/profile/full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      profileData = await res.json();
    } catch {
      return;
    }
  }

  const fields = collectPageFields();
  if (fields.length === 0) return;

  matchResults = matchFields(fields, profileData);
  if (matchResults.length === 0) return;

  // Pre-fetch LLM answers for open-ended fields
  const hasOpenEnded = matchResults.some((r) => r.source === "llm_pending");
  if (hasOpenEnded) {
    await fetchLLMAnswers();
  }

  showFloatingButton(matchResults.length);
}

async function getStorageValue(key: string, fallback = ""): Promise<string> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as string | undefined) ?? fallback;
}

function showFloatingButton(fieldCount: number): void {
  const btn = document.createElement("div");
  btn.id = "hiremeplz-fab";
  btn.innerHTML = `
    <div id="hiremeplz-fab-btn">
      <span>HireMePlz</span>
      <span class="hiremeplz-badge">${fieldCount}</span>
    </div>
  `;
  document.body.appendChild(btn);
  btn.addEventListener("click", () => showPreviewPanel());
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getIcon(source: string): string {
  if (source === "rule_match") return "\u2713";
  if (source === "llm" || source === "llm_pending") return "\uD83E\uDD16";
  return "?";
}

function showPreviewPanel(): void {
  const existing = document.getElementById("hiremeplz-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "hiremeplz-panel";

  const fieldsHtml = matchResults
    .map((r, i) => {
      const isTextarea = r.type === "open_ended";
      const valueHtml = isTextarea
        ? `<textarea data-index="${i}" class="hiremeplz-input" rows="3">${escapeHtml(r.value || "")}</textarea>`
        : `<input type="text" value="${escapeHtml(r.value || "")}" data-index="${i}" class="hiremeplz-input" />`;

      return `
        <div class="hiremeplz-field">
          <div class="hiremeplz-field-label">${escapeHtml(r.label || r.field_id)}</div>
          <div class="hiremeplz-field-value">${valueHtml}</div>
          <div class="hiremeplz-field-conf">${getIcon(r.source)}</div>
        </div>`;
    })
    .join("");

  panel.innerHTML = `
    <div class="hiremeplz-panel-header">
      <span>HireMePlz — Preview</span>
      <button id="hiremeplz-close">&times;</button>
    </div>
    <div class="hiremeplz-panel-body">${fieldsHtml}</div>
    <div class="hiremeplz-panel-footer">
      <button id="hiremeplz-fill-btn">Fill All</button>
    </div>
  `;

  document.body.appendChild(panel);

  document
    .getElementById("hiremeplz-close")!
    .addEventListener("click", () => panel.remove());

  // Handle edits in preview
  panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    ".hiremeplz-input"
  ).forEach((el) => {
    el.addEventListener("input", () => {
      const idx = parseInt(el.dataset.index!, 10);
      matchResults[idx].value = el.value;
    });
  });

  document
    .getElementById("hiremeplz-fill-btn")!
    .addEventListener("click", async () => {
      await fillAllFields();
      panel.remove();
    });
}

async function fetchLLMAnswers(): Promise<void> {
  const openEndedFields = matchResults.filter(
    (r) => r.source === "llm_pending"
  );
  if (openEndedFields.length === 0) return;

  if (MOCK_MODE) {
    for (const field of openEndedFields) {
      await new Promise((r) => setTimeout(r, 300));
      const q = field.label.toLowerCase();
      if (
        q.includes("challeng") ||
        q.includes("difficult") ||
        q.includes("technical project")
      ) {
        field.value =
          "During my internship at Tech Corp, I was tasked with optimizing a legacy API that had response times exceeding 3 seconds. I profiled the database queries, identified N+1 query issues, and implemented batch loading with Redis caching. This reduced average response time to 400ms — an 87% improvement.";
      } else {
        field.value =
          "I am drawn to this company's commitment to building innovative products that solve real-world problems. My background in full-stack development and cloud computing aligns well with the team's technical direction.";
      }
      field.source = "llm";
      field.confidence = 0.85;
    }
    return;
  }

  const apiUrl = await getStorageValue(
    "hiremeplz-api-url",
    "http://localhost:4000"
  );
  const token = await getStorageValue("hiremeplz-token");
  if (!token) return;

  for (const field of openEndedFields) {
    try {
      const res = await fetch(`${apiUrl}/api/autofill/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: field.label,
          page_url: window.location.href,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        field.value = data.answer;
        field.source = "llm";
        field.confidence = data.confidence || 0.8;
      }
    } catch {
      // Silently fail
    }
  }
}

async function fillAllFields(): Promise<void> {
  for (const result of matchResults) {
    if (!result.value || !result.element) continue;

    writeValue(result.element, result.value);

    // Visual feedback
    result.element.style.outline = "2px solid #3b82f6";
    setTimeout(() => {
      result.element.style.outline = "";
    }, 2000);
  }

  // Record application
  if (MOCK_MODE) return;
  try {
    const apiUrl = await getStorageValue(
      "hiremeplz-api-url",
      "http://localhost:4000"
    );
    const token = await getStorageValue("hiremeplz-token");
    if (token) {
      await fetch(`${apiUrl}/api/autofill/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company: document.title || "",
          role: "",
          jobUrl: window.location.href,
          suggestions: matchResults.map((r) => ({
            fieldId: r.field_id,
            label: r.label,
            value: r.value,
            source: r.source,
          })),
        }),
      });
    }
  } catch {
    // Don't block filling if tracking fails
  }
}

// Run on page load, with retries for dynamically rendered pages (Workday etc.)
async function initWithRetry(attempts = 5, delay = 1500): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    await init();
    if (matchResults.length > 0) return;
    await new Promise((r) => setTimeout(r, delay));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void initWithRetry());
} else {
  void initWithRetry();
}
