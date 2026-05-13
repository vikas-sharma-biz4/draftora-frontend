/**
 * AIModelSelector component
 *
 * Renders the AI model selection card grid.
 */

"use client";

import { AI_MODEL_OPTIONS } from "@/constants";

interface AIModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function AIModelSelector({ value, onChange }: AIModelSelectorProps): JSX.Element {
  return (
    <div className="card mb-14">
      <div className="form-label mb-14">
        AI Model
      </div>
      <div className="grid-2">
        {AI_MODEL_OPTIONS.map(({ value: optionValue, label, provider, description }) => {
          const isSelected = (value ?? "gpt-4o") === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              className={`tone-card${isSelected ? " selected" : ""}`}
              onClick={() => onChange(optionValue)}
            >
              <div className="tone-card-label">
                {label}
                <span className="font-11 text-muted ml-6">({provider})</span>
              </div>
              <div className="tone-card-desc">{description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
