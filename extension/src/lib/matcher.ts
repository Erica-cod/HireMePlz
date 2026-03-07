import { FIELD_RULES } from "./rules";
import type { PageField } from "./detectors";

export type MatchResult = {
  field_id: string;
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  type: "structured" | "open_ended" | "unmatched";
  label: string;
  value: string | null;
  confidence: number;
  source: "rule_match" | "llm_pending" | "llm" | "none";
  profileKey?: string;
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

    // Skip if field already has a value (except selects)
    if (field.element.value && field.type !== "select") {
      continue;
    }

    let matched = false;

    // Check if it's an open-ended question
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

    // Try rule-based matching
    for (const [pattern, profileKey] of FIELD_RULES) {
      if (pattern.test(searchText)) {
        const value = getProfileValue(profileData, profileKey);
        if (value !== null && value !== undefined && value !== "") {
          results.push({
            field_id: field.id,
            element: field.element,
            type: "structured",
            label: field.label || field.name || field.id,
            value: String(value),
            confidence: 0.9,
            source: "rule_match",
            profileKey,
          });
          matched = true;
          break;
        }
      }
    }

    if (!matched && field.required) {
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
