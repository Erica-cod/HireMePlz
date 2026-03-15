import { collectPageFields, writeValue } from "./lib/detectors";
import { matchFields, type MatchResult } from "./lib/matcher";

// ============ MOCK MODE ============
const MOCK_MODE = false;

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
let autofillContext: { company: string; role: string } = {
  company: "",
  role: "",
};

type BackendSuggestion = {
  fieldId: string;
  label: string;
  kind: "structured" | "open_ended";
  confidence: number;
  value: string;
  reasoning: string;
};

function isApplicationPage(): boolean {
  const url = window.location.href.toLowerCase();
  const patterns = [
    "greenhouse.io",
    "lever.co",
    "workday.com",
    "myworkdayjobs.com",
    "icims.com",
    "smartrecruiters.com",
    "jobvite.com",
    "ashbyhq.com",
    "breezy.hr",
    "recruitee.com",
    "taleo.net",
    "successfactors.com",
    "amazon.jobs",
    "jobs.lever.co",
    "boards.greenhouse.io",
    "apply",
    "application",
    "career",
    "jobs",
    "hiring",
    "recruit",
  ];
  return patterns.some((p) => url.includes(p));
}

async function init(): Promise<void> {
  if (!MOCK_MODE && !isApplicationPage()) return;

  const fields = collectPageFields();
  if (fields.length === 0) return;

  if (MOCK_MODE) {
    matchResults = matchFields(fields, MOCK_PROFILE);
  } else {
    const apiUrl = await getStorageValue(
      "hiremeplz-api-url",
      "http://localhost:4000"
    );
    const token = await getStorageValue("hiremeplz-token");
    if (!token) return;

    autofillContext = inferAutofillContext();
    const suggestions = await requestSuggestions(fields, apiUrl, token);
    matchResults = toMatchResults(fields, suggestions);
  }

  if (matchResults.length === 0) return;

  // In mock mode we still emulate delayed LLM completion.
  if (MOCK_MODE && matchResults.some((r) => r.source === "llm_pending")) {
    await fetchLLMAnswers();
  }

  showFloatingButton(matchResults.length);
}

async function getStorageValue(key: string, fallback = ""): Promise<string> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as string | undefined) ?? fallback;
}

function showFloatingButton(fieldCount: number): void {
  document.getElementById("hiremeplz-fab")?.remove();

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

  // Non-mock mode gets open-ended suggestions from /api/autofill/suggestions.
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
      const persistedSuggestions = matchResults
        .filter((r) => r.value && r.source !== "none")
        .map((r) => ({
          fieldId: r.field_id,
          label: r.label,
          kind: r.type === "open_ended" ? "open_ended" : "structured",
          confidence: r.confidence,
          value: r.value || "",
          reasoning:
            r.source === "llm"
              ? "Generated from story library and profile context"
              : `Matched from profile key: ${r.profileKey || "unknown"}`,
        }));

      await fetch(`${apiUrl}/api/autofill/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company:
            autofillContext.company ||
            document.title ||
            window.location.hostname,
          role: autofillContext.role || document.title || "Unknown role",
          jobUrl: window.location.href,
          suggestions: persistedSuggestions,
        }),
      });
    }
  } catch {
    // Don't block filling if tracking fails
  }
}

async function requestSuggestions(
  fields: ReturnType<typeof collectPageFields>,
  apiUrl: string,
  token: string
): Promise<BackendSuggestion[]> {
  try {
    const payload = {
      company: autofillContext.company || undefined,
      role: autofillContext.role || undefined,
      fields: fields.map((field) => ({
        id: field.id,
        label: field.label,
        name: field.name,
        placeholder: field.placeholder,
        tagName: field.tagName,
        type: field.type,
        options: field.options,
        nearbyText: field.nearbyText,
        required: field.required,
      })),
    };

    const res = await fetch(`${apiUrl}/api/autofill/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions?: BackendSuggestion[] };
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

function toMatchResults(
  fields: ReturnType<typeof collectPageFields>,
  suggestions: BackendSuggestion[]
): MatchResult[] {
  const fieldsById = new Map<
    string,
    Array<{ field: (typeof fields)[number]; index: number }>
  >();
  for (const [index, field] of fields.entries()) {
    const queue = fieldsById.get(field.id) || [];
    queue.push({ field, index });
    fieldsById.set(field.id, queue);
  }

  const results: MatchResult[] = [];
  const usedIndices = new Set<number>();

  for (const suggestion of suggestions) {
    const queue = fieldsById.get(suggestion.fieldId);
    const entry = queue?.shift();
    if (!entry) {
      continue;
    }
    const { field, index } = entry;
    usedIndices.add(index);

    results.push({
      field_id: field.id,
      element: field.element,
      type: suggestion.kind,
      label: suggestion.label || field.label || field.name || field.id,
      value: suggestion.value,
      confidence: suggestion.confidence,
      source: suggestion.kind === "open_ended" ? "llm" : "rule_match",
    });
  }

  for (const [index, field] of fields.entries()) {
    if (field.required && !usedIndices.has(index)) {
      results.push({
        field_id: field.id,
        element: field.element,
        type: "unmatched",
        label: field.label || field.name || field.id,
        value: null,
        confidence: 0,
        source: "none",
      });
    }
  }

  return results;
}

function inferAutofillContext(): { company: string; role: string } {
  const title = document.title.trim();
  const heading =
    document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "";

  let role = "";
  let company = "";

  const atMatch = heading.match(/(.+?)\s+at\s+(.+)/i) || title.match(/(.+?)\s+at\s+(.+)/i);
  if (atMatch) {
    role = atMatch[1]?.trim() || "";
    company = atMatch[2]?.trim() || "";
  }

  if (!role) {
    role = heading || title;
  }

  if (!company) {
    const siteName = document
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute("content")
      ?.trim();
    company = siteName || window.location.hostname.replace(/^www\./, "");
  }

  return { company, role };
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
