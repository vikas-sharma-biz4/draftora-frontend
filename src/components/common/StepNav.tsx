"use client";

import { WIZARD_STEPS } from "@/constants";

interface StepNavProps {
  currentStep: number;
}

export default function StepNav({ currentStep }: StepNavProps): JSX.Element {
  const step = WIZARD_STEPS.find((s) => s.step === currentStep);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px",
      }}
    >
      {WIZARD_STEPS.map(({ step: s, label }, index) => (
        <span
          key={s}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
          }}
        >
          {index > 0 && (
            <span style={{ color: "var(--color-text-light)" }}>›</span>
          )}
          <span
            style={{
              color:
                s === currentStep
                  ? "var(--color-primary)"
                  : s < currentStep
                    ? "var(--color-success)"
                    : "var(--color-text-light)",
              fontWeight: s === currentStep ? "700" : "400",
            }}
          >
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}
