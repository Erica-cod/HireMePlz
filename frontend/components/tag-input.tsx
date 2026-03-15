"use client";

import { useState } from "react";

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  optional?: boolean;
}

export function TagInput({ label, tags, onChange, placeholder, optional = true }: TagInputProps) {
  const [input, setInput] = useState("");

  function addTag() {
    const tag = input.trim();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
      setInput("");
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}{" "}
        {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder || `Type and press Enter to add`}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addTag}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-blue-600 hover:text-blue-900"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
