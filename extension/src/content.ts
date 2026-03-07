import { collectPageFields, writeValue } from "./lib/detectors";

type Suggestion = {
  fieldId: string;
  label: string;
  kind: "structured" | "open_ended";
  confidence: number;
  value: string;
  reasoning: string;
};

const panelId = "hiremeplz-panel";

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  return element;
}

async function getStorageValue(key: string, fallback = "") {
  const result = await chrome.storage.local.get(key);
  return (result[key] as string | undefined) ?? fallback;
}

async function setStorageValue(key: string, value: string) {
  await chrome.storage.local.set({ [key]: value });
}

async function requestSuggestions(params: {
  apiUrl: string;
  token: string;
  company: string;
  role: string;
}) {
  const fields = collectPageFields();
  const response = await fetch(`${params.apiUrl}/api/autofill/suggestions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`
    },
    body: JSON.stringify({
      company: params.company,
      role: params.role,
      fields: fields.map(({ element, ...field }) => field)
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch suggestions");
  }

  return {
    fields,
    suggestions: data.suggestions as Suggestion[]
  };
}

function ensurePanel() {
  const existing = document.getElementById(panelId);
  if (existing) {
    return existing;
  }

  const panel = createElement("div");
  panel.id = panelId;
  document.body.appendChild(panel);
  return panel;
}

async function renderPanel() {
  const panel = ensurePanel();
  const apiUrl = await getStorageValue("hiremeplz-api-url", "http://localhost:4000");
  const token = await getStorageValue("hiremeplz-token");

  panel.innerHTML = "";
  const body = createElement("div", "panel-body");
  body.innerHTML = `
    <h3>HireMePlz Autofill</h3>
    <p class="muted">Scan fields on this page, review suggestions, then fill them manually.</p>
    <input id="hiremeplz-api-url" value="${apiUrl}" placeholder="API URL" />
    <input id="hiremeplz-token" value="${token}" placeholder="Login token" />
    <input id="hiremeplz-company" placeholder="Company (optional)" />
    <input id="hiremeplz-role" placeholder="Role (optional)" />
    <button id="hiremeplz-scan" class="primary">Scan and fetch suggestions</button>
    <div id="hiremeplz-status" class="muted"></div>
    <div id="hiremeplz-suggestions"></div>
  `;
  panel.appendChild(body);

  const apiInput = panel.querySelector<HTMLInputElement>("#hiremeplz-api-url");
  const tokenInput = panel.querySelector<HTMLInputElement>("#hiremeplz-token");
  const companyInput = panel.querySelector<HTMLInputElement>("#hiremeplz-company");
  const roleInput = panel.querySelector<HTMLInputElement>("#hiremeplz-role");
  const button = panel.querySelector<HTMLButtonElement>("#hiremeplz-scan");
  const status = panel.querySelector<HTMLDivElement>("#hiremeplz-status");
  const suggestionsNode =
    panel.querySelector<HTMLDivElement>("#hiremeplz-suggestions");

  if (!apiInput || !tokenInput || !companyInput || !roleInput || !button || !status || !suggestionsNode) {
    return;
  }

  apiInput.addEventListener("change", () =>
    setStorageValue("hiremeplz-api-url", apiInput.value.trim())
  );
  tokenInput.addEventListener("change", () =>
    setStorageValue("hiremeplz-token", tokenInput.value.trim())
  );

  button.addEventListener("click", async () => {
    try {
      status.textContent = "Scanning fields and requesting suggestions...";
      suggestionsNode.innerHTML = "";
      const result = await requestSuggestions({
        apiUrl: apiInput.value.trim(),
        token: tokenInput.value.trim(),
        company: companyInput.value.trim(),
        role: roleInput.value.trim()
      });

      if (result.suggestions.length === 0) {
        status.textContent = "No fillable suggestions detected. Please complete your profile first.";
        return;
      }

      status.textContent = `Generated ${result.suggestions.length} suggestions.`;
      for (const suggestion of result.suggestions) {
        const field = result.fields.find((item) => item.id === suggestion.fieldId);
        if (!field) {
          continue;
        }

        const item = createElement("div", "suggestion");
        const textarea = createElement("textarea");
        textarea.value = suggestion.value;
        item.innerHTML = `
          <strong>${suggestion.label}</strong>
          <p class="muted">Confidence ${Math.round(suggestion.confidence * 100)}% · ${suggestion.reasoning}</p>
        `;
        item.appendChild(textarea);

        const fillButton = createElement("button", "secondary");
        fillButton.textContent = "Fill this field";
        fillButton.addEventListener("click", () => {
          writeValue(field.element, textarea.value);
          status.textContent = `Filled: ${suggestion.label}`;
        });
        item.appendChild(fillButton);
        suggestionsNode.appendChild(item);
      }

      const saveButton = createElement("button", "primary");
      saveButton.textContent = "Save this application record";
      saveButton.addEventListener("click", async () => {
        await fetch(`${apiInput.value.trim()}/api/autofill/record`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenInput.value.trim()}`
          },
          body: JSON.stringify({
            company: companyInput.value.trim() || document.title,
            role: roleInput.value.trim() || "Role not provided",
            jobUrl: window.location.href,
            suggestions: Array.from(
              suggestionsNode.querySelectorAll<HTMLTextAreaElement>("textarea")
            ).map((node, index) => ({
              ...result.suggestions[index],
              value: node.value
            }))
          })
        });
        status.textContent = "Application record saved";
      });
      suggestionsNode.appendChild(saveButton);
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "An error occurred while fetching suggestions";
    }
  });
}

void renderPanel();
