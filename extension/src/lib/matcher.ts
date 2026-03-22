import { FIELD_RULES } from "./rules";
import type { PageField } from "./detectors";

export type MatchResult = {
  field_id: string;
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  radioGroup?: HTMLInputElement[];
  type: "structured" | "open_ended" | "no_match" | "unmatched";
  label: string;
  value: string | null;
  confidence: number;
  source: "rule_match" | "llm_pending" | "llm" | "story_match" | "none";
  profileKey?: string;
  sourceStoryTitle?: string;
  matchScore?: number;
};

export function matchFields(
  fields: PageField[],
  profileData: Record<string, unknown>
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const field of fields) {
    const searchText = [
      field.name,
      field.id,
      field.label,
      field.placeholder,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // Skip text/textarea fields that already have a value
    if (
      field.element.value &&
      field.type !== "select" &&
      field.type !== "radio" &&
      field.type !== "checkbox"
    ) {
      continue;
    }

    // Skip already-checked checkboxes
    if (
      field.type === "checkbox" &&
      (field.element as HTMLInputElement).checked
    ) {
      continue;
    }

    // Open-ended textarea → let LLM answer
    if (
      field.tagName === "TEXTAREA" &&
      field.label &&
      field.label.length > 20
    ) {
      results.push({
        field_id: field.id,
        element: field.element,
        type: "open_ended",
        label: field.label || field.id,
        value: null,
        confidence: 0,
        source: "llm_pending",
      });
      continue;
    }

    let matched = false;

    // Rule-based matching
    for (const [pattern, profileKey] of FIELD_RULES) {
      if (pattern.test(searchText)) {
        const value = getProfileValue(profileData, profileKey);
        if (value !== null && value !== undefined && value !== "") {
          const resolvedValue = resolveValueForField(field, String(value));
          if (resolvedValue !== null) {
            results.push({
              field_id: field.id,
              element: field.element,
              radioGroup: field.radioGroup,
              type: "structured",
              label: field.label || field.name || field.id,
              value: resolvedValue,
              confidence: 0.9,
              source: "rule_match",
              profileKey,
            });
            matched = true;
            break;
          }
        }
      }
    }

    if (!matched && field.required) {
      results.push({
        field_id: field.id,
        element: field.element,
        radioGroup: field.radioGroup,
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

/**
 * For radio groups, verify that the profile value actually matches one of the
 * options (or a normalised version of it).  Returns null if no option matches
 * so the field is skipped rather than filled with a wrong value.
 */
function resolveValueForField(
  field: PageField,
  value: string
): string | null {
  if (field.type === "radio" && field.options && field.radioGroup) {
    const n = norm(value);
    const match = field.options.find((opt) => {
      const on = norm(opt);
      return on === n || on.startsWith(n) || n.startsWith(on);
    });
    // Return the option label as-is (writeValue normalises again)
    return match ?? null;
  }

  // Checkboxes: any non-empty profile value is meaningful
  if (field.type === "checkbox") {
    return value;
  }

  return value;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getProfileValue(
  data: Record<string, unknown>,
  key: string
): string | null {
  if (!data) return null;

  const parts = key.split(".");
  if (parts.length === 1) {
    if (key === "full_name" && data.first_name && data.last_name) {
      return `${data.first_name} ${data.last_name}`;
    }
    const val = data[key];
    return val != null ? String(val) : null;
  }

  // Nested: education.school -> data.education[0].school
  const [section, field] = parts;
  const arr = data[section];
  if (Array.isArray(arr) && arr.length > 0) {
    const val = (arr[0] as Record<string, unknown>)[field];
    return val != null ? String(val) : null;
  }

  return null;
}
