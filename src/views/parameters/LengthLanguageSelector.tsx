/**
 * LengthLanguageSelector component
 *
 * Renders the proposal length and language/locale selection cards.
 */

"use client";

import { Select } from "@/components/common/Input";
import { LANGUAGE_OPTIONS, LENGTH_OPTIONS, AI_MODEL_OPTIONS } from "@/constants";
import type { LengthOption } from "@/interfaces/proposalInterfaces";

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
  language,
  aiModel,
  onLengthChange,
  onLanguageChange,
  onAiModelChange,
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
          className="form-select mb-14"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </Select>
        <div className="form-label mb-24">
          AI Model
        </div>
        <div className="grid-2">
          {AI_MODEL_OPTIONS.map(({ value: optionValue, label, provider, description }) => {
            const isSelected = (aiModel ?? "gpt-4o") === optionValue;
            return (
              <button
                key={optionValue}
                type="button"
                className={`tone-card${isSelected ? " selected" : ""}`}
                onClick={() => onAiModelChange(optionValue)}
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
    </div>
  );
}
