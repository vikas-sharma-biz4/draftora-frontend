"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Check } from "lucide-react";

import styles from "./DynamicPipeline.module.scss";
import type { DraftStage } from "@/interfaces/draftInterfaces";
import { PIPELINE_STEPS } from "@/interfaces/draftInterfaces";
import { toast } from "@/utils/toast";

interface DynamicPipelineProps {
  currentStage: DraftStage;
  completedSteps: number[];
  visitedSteps?: number[];
  onStepClick?: (stepId: number, path: string) => void;
  visible: boolean;
  proposalId?: number | null;
  maxStepReached?: number;
}

export default function DynamicPipeline({
  currentStage,
  completedSteps = [],
  visitedSteps,
  onStepClick,
  visible,
  proposalId,
  maxStepReached,
}: DynamicPipelineProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  function handleStepClick(stepId: number, path: string): void {
    if (onStepClick) {
      onStepClick(stepId, path);
      return;
    }

    if (stepId === 3) {
      // Web View requires a generated proposal — guard against /web-view 404
      if (proposalId) {
        router.push(`/proposal/${proposalId}`);
      } else {
        toast.error("Generate a proposal first to view it here.");
      }
      return;
    }

    if (proposalId) {
      // Append proposalId to preserve context when navigating to earlier steps
      router.push(`${path}?proposalId=${proposalId}`);
    } else {
      router.push(path);
    }
  }

  function getCurrentStepId(): number {
    // URL-first: always reflects the page the user is actually on
    if (pathname === "/parameters") return 1;
    if (pathname === "/review") return 2;
    if (pathname.startsWith("/generating/")) return 2;
    if (pathname.startsWith("/proposal/") || pathname === "/web-view") return 3;
    // Fallback for home page or other routes
    if (currentStage === "wizard_in_progress") return 1;
    if (currentStage === "parameters_complete") return 2;
    if (currentStage === "review_complete" || currentStage === "generated") return 3;
    return 0;
  }

  const currentStepId = getCurrentStepId();
  const isAllCompleted = currentStage === "generated";
  const allowNonLinearNav = currentStage === "generated";

  // Use visitedSteps for completion state if available (persisted to localStorage)
  // Otherwise fall back to completedSteps (from draftSessionStore)
  const stepsForCompletion = visitedSteps && visitedSteps.length > 0 ? visitedSteps : completedSteps;

  // Determine the highest step the user has reached
  // This allows going back to Step 1 and then returning to Step 2 if they've already been there
  const highestReached = maxStepReached ?? currentStepId;

  return (
    <div
      className={`${styles.pipelineContainer} ${visible ? styles.visible : styles.hidden}`}
      aria-hidden={!visible}
    >
      <div className={styles.pipelineSteps}>
        {PIPELINE_STEPS.map((step, index) => {
          const isActive = step.id === currentStepId;
          // A step is "completed" (green) if it's in visitedSteps and before current step (or fully generated).
          // This uses persisted visitedSteps from localStorage to survive refreshes.
          const isCompleted = (stepsForCompletion.includes(step.id) && step.id < currentStepId) || isAllCompleted;

          // Progressive navigation: Allow clicking any step up to the highest reached
          // Example: If user reached Step 2, they can go back to Step 1 and return to Step 2
          // But they cannot skip ahead to Step 3 until they've visited it
          const isClickable = allowNonLinearNav || step.id <= highestReached;

          return (
            <React.Fragment key={step.id}>
              <div
                className={`${styles.step} ${isActive ? styles.active : ""} ${isCompleted ? styles.completed : ""} ${isClickable ? styles.clickable : ""}`}
                onClick={() => isClickable && handleStepClick(step.id, step.path)}
                role="button"
                tabIndex={isClickable ? 0 : -1}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${step.label} - ${isCompleted ? "Completed" : isActive ? "Current" : "Upcoming"}`}
              >
                <div className={styles.stepCircle}>
                  {isCompleted ? (
                    <Check size={12} className={styles.checkIcon} strokeWidth={3} />
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
