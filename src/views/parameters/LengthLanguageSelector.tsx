"use client";

import { LENGTH_OPTIONS } from "@/constants";
import type { LengthOption } from "@/interfaces/proposalInterfaces";

const LENGTH_DEPTH: Record<string, number> = {
  concise: 1,
  balanced: 2,
  comprehensive: 3,
};

const MAX_DEPTH = 3;

interface LengthLanguageSelectorProps {
  lengthPreference: LengthOption;
  language: string;
  aiModel: string;
  onLengthChange: (value: LengthOption) => void;
  onLanguageChange: (value: string) => void;
  onAiModelChange: (value: string) => void;
}

export default function LengthLanguageSelector({
  lengthPreference,
  onLengthChange,
}: LengthLanguageSelectorProps): JSX.Element {
  return (
    <div className="mb-16">
      <div className="card">
        <div className="form-label mb-16">Proposal Length</div>
        <div className="flex-col gap-8">
          {LENGTH_OPTIONS.map(({ value, label, description }) => {
            const isSelected = lengthPreference === value;
            const depth = LENGTH_DEPTH[value] ?? 1;
            return (
              <div
                key={value}
                className={`length-option${isSelected ? " selected" : ""}`}
                onClick={() => onLengthChange(value)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onLengthChange(value);
                }}
              >
                <div className="length-option-body">
                  <div className="length-option-label">{label}</div>
                  <span className="length-option-desc">{description}</span>
                </div>
                <div className="length-depth-indicator">
                  {Array.from({ length: MAX_DEPTH }, (_, i) => (
                    <div key={i} className={`length-depth-bar${i < depth ? " active" : ""}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
