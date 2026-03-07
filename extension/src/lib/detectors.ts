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
};

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
  if (ariaLabel) {
    return ariaLabel;
  }

  // 5. data-automation-id (Workday specific)
  const automationId = htmlElement.getAttribute("data-automation-id");
  if (automationId) {
    return automationId.replace(/[-_]/g, " ");
  }

  // 6. placeholder as last resort
  return (htmlElement as HTMLInputElement).placeholder || undefined;
}

function extractNearbyText(element: Element): string | undefined {
  const container = element.closest("div, section, article, fieldset");
  return container?.textContent?.replace(/\s+/g, " ").trim().slice(0, 240);
}

const FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select';

function querySelectorAllDeep(
  selector: string,
  root: Document | ShadowRoot | Element = document
): Element[] {
  const results: Element[] = [];

  // Query in the current root
  const found =
    "querySelectorAll" in root ? root.querySelectorAll(selector) : [];
  results.push(...Array.from(found));

  // Traverse children for shadow roots
  const allElements =
    "querySelectorAll" in root ? root.querySelectorAll("*") : [];
  for (const el of Array.from(allElements)) {
    if (el.shadowRoot) {
      results.push(...querySelectorAllDeep(selector, el.shadowRoot));
    }
  }

  return results;
}

export function collectPageFields(): PageField[] {
  const elements = querySelectorAllDeep(FIELD_SELECTOR).filter((el) => {
    const htmlEl = el as HTMLInputElement;
    return !htmlEl.disabled;
  }) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

  return elements.map<PageField>((element, index) => ({
    id: element.id || element.name || `field-${index + 1}`,
    label: getLabel(element),
    name: element.getAttribute("name") || undefined,
    placeholder: element.getAttribute("placeholder") || undefined,
    tagName: element.tagName,
    type: "type" in element ? element.type : undefined,
    options:
      element.tagName === "SELECT"
        ? Array.from((element as HTMLSelectElement).options).map(
            (option) => option.textContent || ""
          )
        : undefined,
    nearbyText: extractNearbyText(element),
    required:
      element.matches("[required]") ||
      element.getAttribute("aria-required") === "true",
    element,
  }));
}

export function writeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
): void {
  element.focus();

  if (element instanceof HTMLSelectElement) {
    const option = Array.from(element.options).find(
      (item) =>
        item.textContent?.trim().toLowerCase() === value.trim().toLowerCase() ||
        item.value.trim().toLowerCase() === value.trim().toLowerCase()
    );
    if (option) {
      element.value = option.value;
    }
  } else {
    // Use native setter for React compatibility
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
