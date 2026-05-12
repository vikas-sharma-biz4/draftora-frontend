/**
 * LengthLanguageSelector component
 *
 * Renders the proposal length and language/locale selection cards.
 */

"use client";

import { Select } from "@/components/common/Input";
import { LANGUAGE_OPTIONS, LENGTH_OPTIONS } from "@/constants";
import type { LengthOption } from "@/interfaces/proposalInterfaces";

interface LengthLanguageSelectorProps {
  lengthPreference: LengthOption;
  language: string;
  onLengthChange: (value: LengthOption) => void;
  onLanguageChange: (value: string) => void;
}

export default function LengthLanguageSelector({
  lengthPreference,
  language,
  onLengthChange,
  onLanguageChange,
}: LengthLanguageSelectorProps): JSX.Element {
  return (
    <div className="grid-2 mb-14">
      <div className="card">
        <div className="form-label mb-14">
          Proposal Length
        </div>
        <div className="flex-col gap-8">
          {LENGTH_OPTIONS.map(({ value, label, description }) => {
            const isSelected = lengthPreference === value;
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
                <div className="flex-between">
                  <span className="length-option-label">{label}</span>
                </div>
                <span className="length-option-desc">{description}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="form-label mb-14">
          Language &amp; Locale
        </div>
        <Select
          className="form-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
