export type PageField = {
  id: string;
  label?: string;
  name?: string;
  placeholder?: string;
  tagName: string;
  type?: string;
  options?: string[];
  nearbyText?: string;
  required: boolean;
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  // Radio groups: all sibling inputs sharing the same name
  radioGroup?: HTMLInputElement[];
};

// ─── Label helpers ───────────────────────────────────────────────────────────

function getLabelInRoot(
  id: string,
  root: Document | ShadowRoot
): string | undefined {
  const label = root.querySelector(`label[for="${id}"]`);
  if (label?.textContent) return label.textContent.trim();

  // Also search shadow roots
  const allElements = root.querySelectorAll("*");
  for (const el of Array.from(allElements)) {
    if (el.shadowRoot) {
      const found = getLabelInRoot(id, el.shadowRoot);
      if (found) return found;
    }
  }
  return undefined;
}

function getLabel(element: Element): string | undefined {
  const htmlElement = element as HTMLElement;

  // 1. Explicit <label for="id"> — search across shadow roots
  const id = htmlElement.getAttribute("id");
  if (id) {
    const found = getLabelInRoot(id, document);
    if (found) return found;
  }

  // 2. Parent <label>
  const parentLabel = htmlElement.closest("label");
  if (parentLabel) {
    const text = parentLabel.textContent?.trim();
    if (text) {
      const inputText =
        (htmlElement as HTMLInputElement).value ||
        (htmlElement as HTMLInputElement).placeholder ||
        "";
      return text.replace(inputText, "").trim();
    }
  }

  // 3. Previous sibling text
  const prev = htmlElement.previousElementSibling;
  if (
    prev &&
    (prev.tagName === "LABEL" ||
      prev.tagName === "SPAN" ||
      prev.tagName === "P")
  ) {
    const text = prev.textContent?.trim();
    if (text) return text;
  }

  // 4. aria-label
  const ariaLabel = htmlElement.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // 5. data-automation-id (Workday specific)
  const automationId = htmlElement.getAttribute("data-automation-id");
  if (automationId) return automationId.replace(/[-_]/g, " ");

  // 6. placeholder as last resort
  return (htmlElement as HTMLInputElement).placeholder || undefined;
}

/** Label for a radio/checkbox group — prefers <fieldset><legend> or role="group" */
function getGroupLabel(first: HTMLInputElement): string | undefined {
  // <fieldset><legend>
  const fieldset = first.closest("fieldset");
  if (fieldset) {
    const legend = fieldset.querySelector("legend");
    if (legend?.textContent) return legend.textContent.trim();
  }

  // role="group" / role="radiogroup" with aria-labelledby
  const group = first.closest('[role="group"],[role="radiogroup"]');
  if (group) {
    const labelledBy = group.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl?.textContent) return labelEl.textContent.trim();
    }
    const ariaLabel = group.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;
  }

  // Fall back to individual label
  return getLabel(first);
}

function extractNearbyText(element: Element): string | undefined {
  const container = element.closest("div, section, article, fieldset");
  return container?.textContent?.replace(/\s+/g, " ").trim().slice(0, 240);
}

// ─── Selectors ───────────────────────────────────────────────────────────────

const TEXT_SELECTOR =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"])' +
  ':not([type="radio"]):not([type="checkbox"]):not([type="file"]), textarea, select';
const RADIO_SELECTOR = 'input[type="radio"]';
const CHECKBOX_SELECTOR = 'input[type="checkbox"]';

function querySelectorAllDeep(
  selector: string,
  root: Document | ShadowRoot | Element = document
): Element[] {
  const results: Element[] = [];

  const found =
    "querySelectorAll" in root ? root.querySelectorAll(selector) : [];
  results.push(...Array.from(found));

  const allElements =
    "querySelectorAll" in root ? root.querySelectorAll("*") : [];
  for (const el of Array.from(allElements)) {
    if (el.shadowRoot) {
      results.push(...querySelectorAllDeep(selector, el.shadowRoot));
    }
  }

  return results;
}

// ─── Field collection ─────────────────────────────────────────────────────────

export function collectPageFields(): PageField[] {
  const fields: PageField[] = [];

  // 1. Text / textarea / select fields (existing logic)
  const textElements = querySelectorAllDeep(TEXT_SELECTOR).filter(
    (el) => !(el as HTMLInputElement).disabled
  ) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

  textElements.forEach((element, index) => {
    fields.push({
      id: element.id || element.name || `field-${index + 1}`,
      label: getLabel(element),
      name: element.getAttribute("name") || undefined,
      placeholder: element.getAttribute("placeholder") || undefined,
      tagName: element.tagName,
      type: "type" in element ? element.type : undefined,
      options:
        element.tagName === "SELECT"
          ? Array.from((element as HTMLSelectElement).options).map(
              (o) => o.textContent?.trim() || o.value
            )
          : undefined,
      nearbyText: extractNearbyText(element),
      required:
        element.matches("[required]") ||
        element.getAttribute("aria-required") === "true",
      element,
    });
  });

  // 2. Radio groups — collect and deduplicate by name
  const radioElements = querySelectorAllDeep(RADIO_SELECTOR).filter(
    (el) => !(el as HTMLInputElement).disabled
  ) as HTMLInputElement[];

  const radioGroupMap = new Map<string, HTMLInputElement[]>();
  radioElements.forEach((radio, index) => {
    const key = radio.name || radio.id || `radio-group-${index}`;
    if (!radioGroupMap.has(key)) radioGroupMap.set(key, []);
    radioGroupMap.get(key)!.push(radio);
  });

  let radioIndex = 0;
  for (const [groupName, radios] of radioGroupMap) {
    const first = radios[0];
    const label = getGroupLabel(first);

    // Collect visible text labels for each radio option
    const options = radios.map((r) => {
      // Prefer the <label> text, fall back to value attribute
      return getLabel(r) || r.value;
    });

    fields.push({
      id: first.id || groupName || `radio-group-${radioIndex++}`,
      label,
      name: groupName,
      tagName: "INPUT",
      type: "radio",
      options,
      nearbyText: extractNearbyText(first),
      required:
        radios.some((r) => r.matches("[required]")) ||
        radios.some((r) => r.getAttribute("aria-required") === "true"),
      element: first,
      radioGroup: radios,
    });
  }

  // 3. Checkboxes (standalone — skip ones in a radio-like group)
  const checkboxElements = querySelectorAllDeep(CHECKBOX_SELECTOR).filter(
    (el) => !(el as HTMLInputElement).disabled
  ) as HTMLInputElement[];

  checkboxElements.forEach((checkbox, index) => {
    const label = getLabel(checkbox);
    fields.push({
      id: checkbox.id || checkbox.name || `checkbox-${index}`,
      label,
      name: checkbox.getAttribute("name") || undefined,
      tagName: "INPUT",
      type: "checkbox",
      nearbyText: extractNearbyText(checkbox),
      required:
        checkbox.matches("[required]") ||
        checkbox.getAttribute("aria-required") === "true",
      element: checkbox,
    });
  });

  return fields;
}

// ─── Value writing ────────────────────────────────────────────────────────────

/** Normalise a string for comparison (lowercase, strip punctuation/spaces) */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TRUTHY_VALUES = new Set(["yes", "true", "1", "on", "agree", "agreed", "accept", "ok", "i agree"]);
const FALSY_VALUES  = new Set(["no", "false", "0", "off", "disagree", "decline"]);

function writeCheckbox(el: HTMLInputElement, value: string): void {
  const n = norm(value);
  const shouldCheck = TRUTHY_VALUES.has(n) || (!FALSY_VALUES.has(n) && Boolean(value));
  if (el.checked !== shouldCheck) {
    el.click();
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function writeRadioGroup(radios: HTMLInputElement[], value: string): void {
  const n = norm(value);
  // Find the radio whose label or value best matches
  const target = radios.find((r) => {
    const rLabel = norm(getLabel(r) || "");
    const rValue = norm(r.value);
    return rValue === n || rLabel === n || rLabel.startsWith(n) || n.startsWith(rLabel);
  });
  if (target && !target.checked) {
    target.click();
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function writeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
  radioGroup?: HTMLInputElement[]
): void {
  element.focus();

  // ── Radio group ──
  if (
    element instanceof HTMLInputElement &&
    element.type === "radio" &&
    radioGroup
  ) {
    writeRadioGroup(radioGroup, value);
    return;
  }

  // ── Checkbox ──
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    writeCheckbox(element, value);
    return;
  }

  // ── Select ──
  if (element instanceof HTMLSelectElement) {
    const n = norm(value);
    const option =
      // Exact match first
      Array.from(element.options).find(
        (o) =>
          norm(o.textContent || "") === n || norm(o.value) === n
      ) ||
      // Partial / prefix match
      Array.from(element.options).find(
        (o) =>
          norm(o.textContent || "").includes(n) ||
          n.includes(norm(o.textContent || ""))
      );
    if (option) {
      element.value = option.value;
    }
  } else {
    // ── Text / textarea ── (React-compatible native setter)
    const proto =
      element.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}
