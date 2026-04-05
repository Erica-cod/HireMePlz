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

const STORAGE_FAB_HIDDEN = "hiremeplz-fab-hidden";

let matchResults: MatchResult[] = [];
let apiError = "";
let autofillContext: { company: string; role: string } = {
  company: "",
  role: "",
};
let popupSessionFabEnabled = false;
let inactiveReason: "no-fields" | null = null;
let suggestionsLoading = false;

type BackendSuggestion = {
  fieldId: string;
  label: string;
  kind: "structured" | "open_ended" | "no_match";
  confidence: number;
  value: string;
  reasoning: string;
  sourceStoryId?: string;
  sourceStoryTitle?: string;
  matchScore?: number;
};

type SuggestionCache = {
  fieldIds: string;
  suggestions: BackendSuggestion[];
  apiError: string;
  autofillContext: { company: string; role: string };
};

let suggestionCache: SuggestionCache | null = null;

function fingerprintFields(fields: ReturnType<typeof collectPageFields>): string {
  return fields.map((f) => f.id).join("\u0001");
}

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

async function getStorageValue(key: string, fallback = ""): Promise<string> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as string | undefined) ?? fallback;
}

async function isFabHiddenStorage(): Promise<boolean> {
  const v = await getStorageValue(STORAGE_FAB_HIDDEN, "");
  return v === "1";
}

async function hideFabFromPage(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_FAB_HIDDEN]: "1" });
  clearExtensionUi();
}

function mountFloatingChrome(opts: {
  mode: "inactive" | "loading" | "active" | "error";
  fieldCount?: number;
}): void {
  document.getElementById("hiremeplz-fab")?.remove();

  const wrap = document.createElement("div");
  wrap.id = "hiremeplz-fab";
  wrap.className = "hiremeplz-fab-wrap";

  const inner = document.createElement("div");
  inner.className = "hiremeplz-fab-inner";

  const xBtn = document.createElement("button");
  xBtn.type = "button";
  xBtn.className = "hiremeplz-fab-x";
  xBtn.setAttribute("aria-label", "Hide floating button");
  xBtn.textContent = "\u00d7";
  xBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void hideFabFromPage();
  });

  const btn = document.createElement("div");
  btn.id = "hiremeplz-fab-btn";
  let label = "HireMePlz";
  let badge = "";
  if (opts.mode === "inactive") {
    btn.classList.add("hiremeplz-fab-inactive");
    badge = "\u2013";
  } else if (opts.mode === "loading") {
    btn.classList.add("hiremeplz-fab-loading");
    btn.innerHTML = `<span>${label}</span><span class="hiremeplz-badge hiremeplz-badge-spinner" aria-label="Loading"><span class="hiremeplz-spinner hiremeplz-spinner-on-primary"></span></span>`;
    btn.addEventListener("click", () => {
      handleFabPrimaryClick();
    });
    inner.appendChild(btn);
    inner.appendChild(xBtn);
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    return;
  } else if (opts.mode === "error") {
    btn.style.background = "#dc2626";
    label = "HireMePlz \u26a0";
    badge = String(opts.fieldCount ?? 0);
  } else {
    badge = String(opts.fieldCount ?? 0);
  }

  btn.innerHTML = `<span>${label}</span><span class="hiremeplz-badge">${badge}</span>`;
  btn.addEventListener("click", () => {
    handleFabPrimaryClick();
  });
  inner.appendChild(btn);
  inner.appendChild(xBtn);
  wrap.appendChild(inner);
  document.body.appendChild(wrap);
}

function handleFabPrimaryClick(): void {
  document.getElementById("hiremeplz-inactive-panel")?.remove();
  if (inactiveReason) {
    showInactiveHelpPanel();
    return;
  }
  showPreviewPanel();
}

function showInactiveHelpPanel(): void {
  document.getElementById("hiremeplz-inactive-panel")?.remove();
  const panel = document.createElement("div");
  panel.id = "hiremeplz-inactive-panel";

  panel.innerHTML = `
      <p>No fillable fields were detected yet. The form may still be loading.</p>
      <button type="button" id="hiremeplz-retry-fields">Retry scan</button>
      <button type="button" id="hiremeplz-inactive-close" class="secondary">Close</button>`;

  document.body.appendChild(panel);

  document.getElementById("hiremeplz-retry-fields")?.addEventListener("click", () => {
    panel.remove();
    void initWithRetry();
  });

  document.getElementById("hiremeplz-inactive-close")?.addEventListener("click", () => {
    panel.remove();
  });
}

async function runAuthenticatedFlow(
  fields: ReturnType<typeof collectPageFields>
): Promise<void> {
  const apiUrl = await getStorageValue("hiremeplz-api-url", "http://localhost:4000");
  const token = await getStorageValue("hiremeplz-token");
  if (!token) {
    clearExtensionUi();
    return;
  }

  autofillContext = inferAutofillContext();
  apiError = "";
  matchResults = [];
  suggestionsLoading = true;
  mountFloatingChrome({ mode: "loading" });

  const suggestions = await requestSuggestions(fields, apiUrl, token);
  suggestionsLoading = false;
  matchResults = toMatchResults(fields, suggestions);

  if (matchResults.length === 0 && !apiError) {
    suggestionCache = null;
    clearExtensionUi();
    return;
  }

  suggestionCache = {
    fieldIds: fingerprintFields(fields),
    suggestions: suggestions.map((s) => ({ ...s })),
    apiError,
    autofillContext: { ...autofillContext }
  };

  mountFloatingChrome({
    mode: apiError ? "error" : "active",
    fieldCount: matchResults.length
  });

  if (document.getElementById("hiremeplz-panel")) {
    showPreviewPanel();
  }
}

async function runMockFabFlow(): Promise<void> {
  const fields = collectPageFields();
  if (fields.length === 0) return;
  matchResults = matchFields(fields, MOCK_PROFILE);
  if (matchResults.some((r) => r.source === "llm_pending")) {
    await fetchLLMAnswers();
  }
  if (matchResults.length === 0 && !apiError) return;
  mountFloatingChrome({
    mode: "active",
    fieldCount: matchResults.length
  });
}

function clearExtensionUi(): void {
  document.getElementById("hiremeplz-fab")?.remove();
  document.getElementById("hiremeplz-panel")?.remove();
  document.getElementById("hiremeplz-inactive-panel")?.remove();
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getIcon(source: string): string {
  if (source === "rule_match") return "\u2713";
  if (source === "story_match") return "\uD83D\uDCD6";
  if (source === "llm" || source === "llm_pending") return "\uD83E\uDD16";
  return "?";
}

function showPreviewPanel(): void {
  const existing = document.getElementById("hiremeplz-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "hiremeplz-panel";

  if (suggestionsLoading && matchResults.length === 0) {
    panel.innerHTML = `
    <div class="hiremeplz-panel-header">
      <span>HireMePlz — Preview</span>
      <button id="hiremeplz-close">&times;</button>
    </div>
    <div class="hiremeplz-panel-body hiremeplz-panel-loading">
      <span class="hiremeplz-spinner hiremeplz-spinner-panel" aria-hidden="true"></span>
      <span>Loading suggestions from the server\u2026</span>
    </div>`;
    document.body.appendChild(panel);
    document
      .getElementById("hiremeplz-close")!
      .addEventListener("click", () => panel.remove());
    return;
  }

  const fieldsHtml = matchResults
    .map((r, i) => {
      if (r.type === "no_match") {
        return `
        <div class="hiremeplz-field" style="opacity:0.5">
          <div class="hiremeplz-field-label">${escapeHtml(r.label || r.field_id)}</div>
          <div class="hiremeplz-field-value"><span style="color:#9ca3af;font-size:12px">No matching story found</span></div>
          <div class="hiremeplz-field-conf">--</div>
        </div>`;
      }

      const isTextarea = r.type === "open_ended";
      const storyInfo = r.sourceStoryTitle
        ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px">From: ${escapeHtml(r.sourceStoryTitle)}${r.matchScore != null ? ` (${(r.matchScore * 100).toFixed(0)}%)` : ""}</div>`
        : "";
      const valueHtml = isTextarea
        ? `${storyInfo}<textarea data-index="${i}" class="hiremeplz-input" rows="3">${escapeHtml(r.value || "")}</textarea>`
        : `<input type="text" value="${escapeHtml(r.value || "")}" data-index="${i}" class="hiremeplz-input" />`;

      return `
        <div class="hiremeplz-field">
          <div class="hiremeplz-field-label">${escapeHtml(r.label || r.field_id)}</div>
          <div class="hiremeplz-field-value">${valueHtml}</div>
          <div class="hiremeplz-field-conf">${getIcon(r.source)}</div>
        </div>`;
    })
    .join("");

  const errorBanner = apiError
    ? `<div style="background:#fef2f2;color:#991b1b;padding:10px 16px;font-size:12px;border-bottom:1px solid #fecaca;">
        ⚠ ${escapeHtml(apiError)}
      </div>`
    : "";

  panel.innerHTML = `
    <div class="hiremeplz-panel-header">
      <span>HireMePlz — Preview</span>
      <button id="hiremeplz-close">&times;</button>
    </div>
    ${errorBanner}
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
    if (!result.value || !result.element || result.type === "no_match") continue;

    writeValue(result.element, result.value, result.radioGroup);

    // Visual feedback (skip for radio/checkbox — outline on hidden input is invisible)
    const el = result.element as HTMLInputElement;
    if (el.type !== "radio" && el.type !== "checkbox") {
      result.element.style.outline = "2px solid #3b82f6";
      setTimeout(() => {
        result.element.style.outline = "";
      }, 2000);
    }
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
        .filter((r) => r.value && r.source !== "none" && r.type !== "no_match")
        .map((r) => ({
          fieldId: r.field_id,
          label: r.label,
          kind: r.type === "open_ended" ? "open_ended" : "structured",
          confidence: r.confidence,
          value: r.value || "",
          reasoning:
            r.source === "story_match"
              ? `Matched from story: ${r.sourceStoryTitle || "unknown"}`
              : r.source === "llm"
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

    console.log(`[HireMePlz] Requesting suggestions for ${fields.length} fields from ${apiUrl}`);

    const res = await fetch(`${apiUrl}/api/autofill/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[HireMePlz] API error ${res.status}: ${errorText}`);
      if (res.status === 401) {
        apiError = "Session expired — please log in again at hiremeplz.info";
        // Clear from extension storage
        await chrome.storage.local.remove(["hiremeplz-token", "hiremeplz-email"]);
        // Also clear from website localStorage so the stale token is not
        // immediately re-synced back, which would create an infinite loop.
        window.localStorage.removeItem("hiremeplz-token");
      } else {
        apiError = `Server error (${res.status})`;
      }
      return [];
    }

    const data = (await res.json()) as { suggestions?: BackendSuggestion[] };
    const suggestions = data.suggestions ?? [];
    console.log(`[HireMePlz] Received ${suggestions.length} suggestions`);
    return suggestions;
  } catch (err) {
    console.error("[HireMePlz] Request failed:", err);
    apiError = "Cannot reach server — check if backend is running";
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
      value: suggestion.value || null,
      confidence: suggestion.confidence,
      source: suggestion.kind === "open_ended"
        ? "story_match"
        : suggestion.kind === "no_match"
          ? "none"
          : "rule_match",
      sourceStoryTitle: suggestion.sourceStoryTitle,
      matchScore: suggestion.matchScore,
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

function tryRestoreFromCache(fields: ReturnType<typeof collectPageFields>): boolean {
  if (!suggestionCache) return false;
  if (fingerprintFields(fields) !== suggestionCache.fieldIds) return false;

  matchResults = toMatchResults(fields, suggestionCache.suggestions);
  apiError = suggestionCache.apiError;
  autofillContext = { ...suggestionCache.autofillContext };
  suggestionsLoading = false;
  inactiveReason = null;

  if (matchResults.length === 0 && !apiError) {
    clearExtensionUi();
    return true;
  }

  mountFloatingChrome({
    mode: apiError ? "error" : "active",
    fieldCount: matchResults.length
  });

  if (document.getElementById("hiremeplz-panel")) {
    showPreviewPanel();
  }
  return true;
}

async function proceedAfterFieldsCollected(
  fields: ReturnType<typeof collectPageFields>
): Promise<void> {
  if (fields.length === 0) {
    inactiveReason = "no-fields";
    mountFloatingChrome({ mode: "inactive" });
    return;
  }

  inactiveReason = null;
  if (tryRestoreFromCache(fields)) return;
  await runAuthenticatedFlow(fields);
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

async function initWithRetry(attempts = 5, delay = 1500): Promise<void> {
  if (await isFabHiddenStorage()) {
    clearExtensionUi();
    return;
  }

  if (MOCK_MODE) {
    let mockFields = collectPageFields();
    for (let i = 0; i < attempts && mockFields.length === 0; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, delay));
      mockFields = collectPageFields();
    }
    if (mockFields.length === 0) return;
    await runMockFabFlow();
    return;
  }

  const token = await getStorageValue("hiremeplz-token");
  if (!token) {
    clearExtensionUi();
    return;
  }

  if (!isApplicationPage() && !popupSessionFabEnabled) {
    clearExtensionUi();
    return;
  }

  let fields = collectPageFields();
  for (let i = 0; i < attempts && fields.length === 0; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delay));
    fields = collectPageFields();
  }

  await proceedAfterFieldsCollected(fields);
}

chrome.runtime.onMessage.addListener(
  (msg: { type?: string }, _sender, sendResponse) => {
    if (msg?.type === "hiremeplz-activate-from-popup") {
      popupSessionFabEnabled = true;
      inactiveReason = null;
      void initWithRetry();
      sendResponse({ ok: true });
    }
    return true;
  }
);

async function syncTokenFromFrontend() {
  const host = window.location.hostname;
  const isLocal = host === "localhost";
  const isProd = host === "hiremeplz.info" || host.endsWith(".hiremeplz.info");
  if (!isLocal && !isProd) return;

  const token = window.localStorage.getItem("hiremeplz-token");
  if (!token) return;

  const stored = await chrome.storage.local.get("hiremeplz-token");
  if (stored["hiremeplz-token"] === token) return;

  let apiUrl: string;
  if (isLocal) {
    apiUrl = `http://localhost:4000`;
  } else {
    apiUrl = `https://api.hiremeplz.info`;
  }

  await chrome.storage.local.set({
    "hiremeplz-token": token,
    "hiremeplz-api-url": apiUrl,
    "hiremeplz-email": "(synced from web)",
  });
  console.log("[HireMePlz] Token synced from frontend");
}

// ─── Startup ──────────────────────────────────────────────────────────────────

function startup() {
  void syncTokenFromFrontend();
  void initWithRetry();
  startFormObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startup);
} else {
  startup();
}

// ─── Field-identity tracking — detect SPA form switches ──────────────────────
// Amazon Jobs and similar SPAs reveal new sections by toggling CSS
// display/visibility without changing the URL or adding DOM nodes.
// Strategy: fast signature of *rendered* fields (getBoundingClientRect),
// checked after every click (sidebar nav) and as a 1s backup poll.

let lastFieldSignature = "";
let spaRescanPending = false;

/**
 * Fast visible-field signature — no shadow DOM traversal, no label detection.
 * Uses getBoundingClientRect to detect truly rendered (non-zero-size) fields.
 */
function getVisibleFieldSignature(): string {
  const els = document.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]):not([type="submit"])' +
    ':not([type="button"]):not([type="file"]),' +
    "textarea, select"
  );
  const sig: string[] = [];
  els.forEach((el) => {
    if ((el as HTMLInputElement).disabled) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return; // hidden / off-screen
    const id = el.id || el.getAttribute("name") || el.tagName;
    const type = (el as HTMLInputElement).type || el.tagName;
    sig.push(`${id}:${type}`);
  });
  return sig.sort().join("|");
}

function maybeTriggerRescan() {
  if (!isApplicationPage()) return;
  if (spaRescanPending) return;
  const sig = getVisibleFieldSignature();
  if (sig === "" || sig === lastFieldSignature) return;
  lastFieldSignature = sig;
  spaRescanPending = true;
  matchResults = [];
  clearExtensionUi();
  void initWithRetry().finally(() => { spaRescanPending = false; });
}

// Fire after any click (sidebar nav, Next/Back buttons, tabs, etc.)
let clickDebounce: ReturnType<typeof setTimeout> | null = null;
document.addEventListener("click", () => {
  if (clickDebounce) clearTimeout(clickDebounce);
  clickDebounce = setTimeout(maybeTriggerRescan, 600);
}, true);

// Backup poll every 1 s for cases where no click is involved
setInterval(maybeTriggerRescan, 1000);

// ─── MutationObserver — catch new form fields *added* to the DOM ──────────────

let observerDebounce: ReturnType<typeof setTimeout> | null = null;

const formObserver = new MutationObserver((mutations) => {
  const hasNewFields = mutations.some((m) =>
    Array.from(m.addedNodes).some((node) => {
      if (!(node instanceof Element)) return false;
      return (
        node.matches("input, select, textarea, fieldset") ||
        node.querySelector("input, select, textarea, fieldset") !== null
      );
    })
  );
  if (!hasNewFields) return;

  if (observerDebounce) clearTimeout(observerDebounce);
  observerDebounce = setTimeout(() => {
    matchResults = [];
    clearExtensionUi();
    void initWithRetry();
  }, 400);
});

function startFormObserver() {
  if (document.body) {
    formObserver.observe(document.body, { childList: true, subtree: true });
  }
}

// ─── SPA navigation — hashchange / pushState / popstate ───────────────────────

function onSpaNavigate() {
  if (observerDebounce) clearTimeout(observerDebounce);
  matchResults = [];
  clearExtensionUi();
  // Give the SPA a moment to render the new view before scanning
  setTimeout(() => void initWithRetry(), 300);
}

window.addEventListener("popstate", onSpaNavigate);
window.addEventListener("hashchange", onSpaNavigate);

// Intercept history.pushState / replaceState (used by React Router etc.)
(function patchHistory() {
  const wrap = (original: typeof history.pushState) =>
    function (this: History, ...args: Parameters<typeof history.pushState>) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event("pushstate"));
      return result;
    };
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
})();
window.addEventListener("pushstate", onSpaNavigate);

// ─── Storage changes (login/logout) ──────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes[STORAGE_FAB_HIDDEN]) {
    if (changes[STORAGE_FAB_HIDDEN].newValue === "1") {
      clearExtensionUi();
    }
    return;
  }

  if (changes["hiremeplz-token"] || changes["hiremeplz-api-url"]) {
    const tok = changes["hiremeplz-token"];
    if (tok && (tok.newValue === undefined || tok.newValue === "")) {
      popupSessionFabEnabled = false;
    }
    suggestionCache = null;
    matchResults = [];
    clearExtensionUi();
    void initWithRetry();
  }
});
