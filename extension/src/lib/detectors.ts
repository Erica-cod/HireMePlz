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

function getLabel(element: Element): string | undefined {
  const htmlElement = element as HTMLElement;

  // 1. Explicit <label for="id">
  const id = htmlElement.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label?.textContent) {
      return label.textContent.trim();
    }
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

  // 5. placeholder as last resort
  return (htmlElement as HTMLInputElement).placeholder || undefined;
}

function extractNearbyText(element: Element): string | undefined {
  const container = element.closest("div, section, article, fieldset");
  return container?.textContent?.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function collectPageFields(): PageField[] {
  const elements = Array.from(
    document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    )
  ).filter((el) => {
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
