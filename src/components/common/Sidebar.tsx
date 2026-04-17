"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, FileText } from "lucide-react";

import { DRAFTS_STORAGE_KEY, WIZARD_STEPS } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import { useSaveDraft, type SavedDraft } from "@/hooks/useSaveDraft";
import type { ProposalData, WizardStep } from "@/types/proposal.types";

function getStepFromPath(pathname: string): WizardStep {
  if (pathname.startsWith("/knowledge-base")) return 2;
  if (pathname.startsWith("/templates")) return 3;
  if (pathname.startsWith("/parameters")) return 4;
  if (pathname.startsWith("/review")) return 5;
  return 1;
}

export default function Sidebar(): JSX.Element {
  const { currentStep, setCurrentStep, proposalData, updateProposalData, hydrated } = useProposal();
  const router = useRouter();
  const pathname = usePathname();
  const saveDraft = useSaveDraft();
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [draftsExpanded, setDraftsExpanded] = useState<boolean>(false);

  // Load saved drafts from localStorage (re-read on every render after hydration
  // so the list reflects saves made from any page)
  useEffect(() => {
    if (!hydrated) return;
    function readDrafts(): void {
      try {
        const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
        setDrafts(raw ? (JSON.parse(raw) as SavedDraft[]) : []);
      } catch {
        // Ignore corrupt storage
      }
    }
    readDrafts();
    // Re-read whenever the window regains focus (e.g. after navigating back)
    window.addEventListener("focus", readDrafts);
    return () => window.removeEventListener("focus", readDrafts);
  }, [hydrated]);

  // Sync currentStep from URL so refreshing on any page shows the correct active step
  useEffect(() => {
    if (!hydrated) return;
    const stepFromPath = getStepFromPath(pathname);
    if (stepFromPath !== currentStep) {
      setCurrentStep(stepFromPath);
    }
  }, [pathname, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // After saveDraft resets and navigates away, re-read drafts list
  function handleSaveDraft(): void {
    saveDraft();
    // Give localStorage a tick to update before re-reading
    setTimeout(() => {
      try {
        const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
        setDrafts(raw ? (JSON.parse(raw) as SavedDraft[]) : []);
        setDraftsExpanded(true);
      } catch {
        // Ignore
      }
    }, 50);
  }

  function handleStepClick(step: number, path: string): void {
    if (step <= currentStep) {
      setCurrentStep(step as WizardStep);
      router.push(path);
    }
  }

  function getStepState(step: number): "active" | "completed" | "upcoming" {
    const active = getStepFromPath(pathname);
    if (step === active) return "active";
    if (step < active) return "completed";
    return "upcoming";
  }

  function handleLoadDraft(draft: SavedDraft): void {
    updateProposalData(draft.proposalData as Partial<ProposalData>);
    setCurrentStep(draft.currentStep);
    const stepPath = WIZARD_STEPS.find((s) => s.step === draft.currentStep)?.path ?? "/";
    router.push(stepPath);
  }

  function handleDeleteDraft(id: string, e: React.MouseEvent): void {
    e.stopPropagation();
    const updated = drafts.filter((d) => d.id !== id);
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    setDrafts(updated);
  }

  function formatDraftDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  const hasContext =
    proposalData.title.trim() !== "" || proposalData.clientName.trim() !== "";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-text">
          <span className="sidebar-logo-dot" />
          Draftora
        </span>
      </div>

      <span className="sidebar-section-label">Proposal Wizard</span>
      <span className="sidebar-section-label sidebar-step-counter">
        Step {getStepFromPath(pathname)} of {WIZARD_STEPS.length}
      </span>

      <ul className="sidebar-steps">
        {WIZARD_STEPS.map(({ step, label, path }) => {
          const state = getStepState(step);
          return (
            <li
              key={step}
              className={`sidebar-step-item ${state === "active" ? "active" : ""} ${state === "completed" ? "completed" : ""}`}
              onClick={() => handleStepClick(step, path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStepClick(step, path);
              }}
            >
              <span className="sidebar-step-indicator">
                {state === "completed" ? "✓" : step}
              </span>
              <span className="sidebar-step-label">{label}</span>
            </li>
          );
        })}
      </ul>

      {hasContext && (
        <div className="sidebar-context-panel">
          <div className="sidebar-context-label">Active Context</div>
          {proposalData.title && (
            <div className="sidebar-context-title">{proposalData.title}</div>
          )}
          {proposalData.clientName && (
            <div className="sidebar-context-subtitle">
              {proposalData.clientName}
            </div>
          )}
        </div>
      )}

      {/* ── Saved Drafts ── */}
      {drafts.length > 0 && (
        <div className="sidebar-drafts-section">
          <button
            className="sidebar-drafts-toggle"
            onClick={() => setDraftsExpanded((v) => !v)}
            aria-expanded={draftsExpanded}
          >
            <Clock size={12} className="icon-shrink-0" />
            <span>Saved Drafts</span>
            <span className="sidebar-drafts-count">{drafts.length}</span>
            {draftsExpanded ? (
              <ChevronDown size={12} className="ml-auto" />
            ) : (
              <ChevronRight size={12} className="ml-auto" />
            )}
          </button>

          {draftsExpanded && (
            <ul className="sidebar-drafts-list">
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="sidebar-draft-item"
                  onClick={() => handleLoadDraft(draft)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLoadDraft(draft);
                  }}
                >
                  <FileText size={11} className="icon-shrink-0 icon-mt-1" />
                  <div className="sidebar-draft-info">
                    <span className="sidebar-draft-title">{draft.title}</span>
                    {draft.clientName && (
                      <span className="sidebar-draft-client">
                        {draft.clientName}
                      </span>
                    )}
                    <span className="sidebar-draft-date">
                      {formatDraftDate(draft.savedAt)}
                    </span>
                  </div>
                  <button
                    className="sidebar-draft-delete"
                    title="Delete draft"
                    onClick={(e) => handleDeleteDraft(draft.id, e)}
                    aria-label="Delete draft"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="sidebar-footer">
        <button
          className="btn btn-secondary btn-sm btn-full"
          onClick={handleSaveDraft}
        >
          Save Draft
        </button>
      </div>
    </aside>
  );
}
