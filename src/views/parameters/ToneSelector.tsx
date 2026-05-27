/**
 * ToneSelector component
 *
 * Renders the tone-of-voice card grid for proposal parameter selection.
 */

"use client";

import { Briefcase, Target, Code, Palette } from "lucide-react";
import { TONE_OPTIONS } from "@/constants";
import type { ToneOption } from "@/interfaces/proposalInterfaces";

const TONE_ICONS = {
  professional: Briefcase,
  persuasive: Target,
  technical: Code,
  creative: Palette,
} as const;

interface ToneSelectorProps {
  value: ToneOption;
  onChange: (value: ToneOption) => void;
}

export default function ToneSelector({ value, onChange }: ToneSelectorProps): JSX.Element {
  return (
    <div className="mt-24 mb-16">
      <div className="form-label mb-24">
        Tone
      </div>
      <div className="tone-grid">
        {TONE_OPTIONS.map(({ value: optionValue, label, description }) => {
          const Icon = TONE_ICONS[optionValue as keyof typeof TONE_ICONS];
          const isSelected = value === optionValue;
          return (
            <div
              key={optionValue}
              className={`tone-card${isSelected ? " selected" : ""}`}
              onClick={() => onChange(optionValue)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onChange(optionValue);
              }}
            >
              <div className="tone-card-icon">
                <Icon size={18} />
              </div>
              <div className="tone-card-label">
                {label}
              </div>
              <div className="tone-card-desc">{description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
