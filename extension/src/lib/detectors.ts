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

function extractLabel(element: Element) {
  const htmlElement = element as HTMLElement;
  const ariaLabel = htmlElement.getAttribute("aria-label");
  if (ariaLabel) {
    return ariaLabel;
  }

  const id = htmlElement.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label?.textContent) {
      return label.textContent.trim();
    }
  }

  const wrappedLabel = htmlElement.closest("label");
  if (wrappedLabel?.textContent) {
    return wrappedLabel.textContent.trim();
  }

  return undefined;
}

function extractNearbyText(element: Element) {
  const container = element.closest("div, section, article, fieldset");
  return container?.textContent?.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function collectPageFields() {
  const selectors = "input, textarea, select";
  const elements = Array.from(document.querySelectorAll(selectors)).filter(
    (element) => {
      const htmlElement = element as HTMLInputElement;
      return htmlElement.type !== "hidden" && !htmlElement.disabled;
    }
  ) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

  return elements.map<PageField>((element, index) => ({
    id: element.id || element.name || `field-${index + 1}`,
    label: extractLabel(element),
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
    required: element.matches("[required]"),
    element
  }));
}

export function writeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
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
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
