"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import styles from "./PipelineStepper.module.scss";

interface PipelineStep {
  id: number;
  label: string;
  path: string;
}

interface PipelineStepperProps {
  currentStep: number;
  onStepClick?: (step: number, path: string) => void;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 1, label: "Parameters", path: "/parameters" },
  { id: 2, label: "Review", path: "/review" },
  { id: 3, label: "Web View", path: "/web-view" },
];

export default function PipelineStepper({ currentStep, onStepClick }: PipelineStepperProps): JSX.Element {
  const router = useRouter();

  function handleStepClick(step: PipelineStep): void {
    if (onStepClick) {
      onStepClick(step.id, step.path);
    } else {
      router.push(step.path);
    }
  }

  return (
    <div className={styles.pipelineContainer}>
      <div className={styles.pipelineSteps}>
        {PIPELINE_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isClickable = step.id <= currentStep;

          return (
            <React.Fragment key={step.id}>
              <div
                className={`${styles.step} ${isActive ? styles.active : ""} ${isCompleted ? styles.completed : ""} ${isClickable ? styles.clickable : ""}`}
                onClick={() => isClickable && handleStepClick(step)}
                role="button"
                tabIndex={isClickable ? 0 : -1}
                aria-current={isActive ? "step" : undefined}
              >
                <div className={styles.stepCircle}>
                  {isCompleted ? (
                    <Check size={16} className={styles.checkIcon} />
                  ) : (
                    <span className={styles.stepNumber}>{step.id}</span>
                  )}
                </div>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>

              {index < PIPELINE_STEPS.length - 1 && (
                <div className={`${styles.connector} ${isCompleted ? styles.completed : ""}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
