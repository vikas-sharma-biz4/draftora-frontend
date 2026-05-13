"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";

import { SECTION_DISPLAY_NAMES } from "@/constants";
import { useProposalWizard, useProposalPipeline, useProposalDraftSession } from "@/context/ProposalContext";
import type { SectionItem } from "@/components/common/SortableSectionList";
import { useWizardAutoSave } from "@/hooks/useWizardAutoSave";
import { useSaveDraft } from "@/hooks/useSaveDraft";

import SectionManager from "./SectionManager";
import ToneSelector from "./ToneSelector";
import LengthLanguageSelector from "./LengthLanguageSelector";
import AIModelSelector from "./AIModelSelector";

const PageLayout = dynamic(() => import("@/layouts/AppLayout"), { ssr: false });

const DynamicPipeline = dynamic(() => import("@/components/common/DynamicPipeline"), {
  ssr: false,
});

function buildSectionItems(
  selectedSections: string[],
  sectionDisplayNames: Record<string, string>,
  originalSections?: Array<{ id: string; level?: number; parentId?: string }>
): SectionItem[] {
  return selectedSections.map((key) => {
    const originalSection = originalSections?.find((s) => s.id === key);

    return {
      key,
      label:
        sectionDisplayNames[key] ??
        SECTION_DISPLAY_NAMES[key] ??
        key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      level: originalSection?.level,
      parentId: originalSection?.parentId,
    };
  });
}

export default function ParametersPage(): JSX.Element {
  const {
    proposalData,
    updateProposalData,
    setCurrentStep,
    currentProposalId,
    shouldStartBackgroundFetch,
    setShouldStartBackgroundFetch,
    maxStepReached,
    setMaxStepReached,
  } = useProposalWizard();
  const { visitedPipelineSteps, syncVisitedStepsFromBackend, markStepVisitedOnBackend } = useProposalPipeline();
  const { draftStage, completedSteps, setDraftStage, markStepCompleted } = useProposalDraftSession();
  const router = useRouter();
  const handleSaveDraft = useSaveDraft();
  const isRegenerating = currentProposalId !== null;
  const isRecreateMode = proposalData.templateType === "recreate";

  // Enable auto-save when user is in pipeline stage
  useWizardAutoSave({ enabled: true, debounceMs: 2000 });

  // Sync visited steps from backend on mount
  useEffect(() => {
    if (currentProposalId) {
      syncVisitedStepsFromBackend(currentProposalId);
    }
  }, [currentProposalId, syncVisitedStepsFromBackend]);

  const [sections, setSections] = useState<SectionItem[]>(() =>
    buildSectionItems(
      proposalData.selectedSections,
      proposalData.sectionDisplayNames,
      proposalData.originalSections
    )
  );

  // Sync local sections state with proposalData (e.g., after localStorage rehydration)
  useEffect(() => {
    setSections(
      buildSectionItems(
        proposalData.selectedSections,
        proposalData.sectionDisplayNames,
        proposalData.originalSections
      )
    );
  }, [proposalData.selectedSections, proposalData.sectionDisplayNames, proposalData.originalSections]);

  // Mark step 1 as visited when this page loads
  useEffect(() => {
    markStepCompleted(1);
  }, [markStepCompleted]);

  // Restore scroll position from draft UI state
  useEffect(() => {
    try {
      const uiStateStr = sessionStorage.getItem("draft_ui_state");
      if (uiStateStr) {
        const uiState = JSON.parse(uiStateStr);
        if (uiState.scrollPosition > 0) {
          setTimeout(() => {
            window.scrollTo({
              top: uiState.scrollPosition,
              behavior: "smooth",
            });
          }, 300);
        }
        sessionStorage.removeItem("draft_ui_state");
      }
    } catch {
      // Ignore errors restoring UI state
    }
  }, []);

  async function handleNext(): Promise<void> {
    if (sections.length === 0) {
      toast.error("Please add at least one section.");
      return;
    }
    const keys = sections.map((s) => s.key);
    const displayNames: Record<string, string> = {};
    for (const s of sections) {
      displayNames[s.key] = s.label;
    }
    updateProposalData({
      selectedSections: keys,
      sectionDisplayNames: displayNames,
      customSections: [],
    });

    // Mark Step 1 as visited when proceeding to Review
    if (currentProposalId) {
      await markStepVisitedOnBackend(currentProposalId, 1);
    }

    markStepCompleted(1);
    setDraftStage("parameters_complete");
    setCurrentStep(5);
    
    // Update maxStepReached to allow returning to Step 2 from Step 1
    if (maxStepReached < 2) {
      setMaxStepReached(2);
    }
    
    router.push("/review");

    if (isRegenerating) {
      toast.info("Parameters updated. Review and regenerate to apply changes.");
    }
  }

  function handleBack(): void {
    setCurrentStep(1);
    router.push("/");
  }

  return (
    <PageLayout noPadding>
        <DynamicPipeline
          currentStage={draftStage}
          completedSteps={completedSteps}
          visitedSteps={visitedPipelineSteps}
          visible={true}
          proposalId={currentProposalId}
          maxStepReached={maxStepReached}
        />
        <div className="page-badge">Phase 04</div>
        <h1 className="page-title">Step 4: Table of Contents &amp; Parameters</h1>
        <p className="page-subtitle">
          {isRecreateMode
            ? "Sections extracted from your document are shown below. Reorder, rename, or add sections — each will be rewritten with the new context."
            : "Review and refine the proposal structure. Reorder, rename, or remove sections — and set the tone for the generated content."}
        </p>

        {isRecreateMode && (
          <div className="recreate-banner">
            <div>
              <strong>Recreate Mode</strong>
              {proposalData.exactDocumentName && (
                <span className="recreate-banner-file"> · {proposalData.exactDocumentName}</span>
              )}
              <div className="recreate-banner-hint">
                {proposalData.originalSections?.length ?? 0} sections will be rewritten using new context.
              </div>
            </div>
          </div>
        )}

        <SectionManager
          sections={sections}
          onSectionsChange={setSections}
          proposalData={proposalData}
          onUpdateProposalData={updateProposalData}
          isRecreateMode={isRecreateMode}
          shouldStartBackgroundFetch={shouldStartBackgroundFetch}
          onBackgroundFetchStarted={() => setShouldStartBackgroundFetch(false)}
        />

        <ToneSelector
          value={proposalData.tone}
          onChange={(value) => updateProposalData({ tone: value })}
        />

        <LengthLanguageSelector
          lengthPreference={proposalData.lengthPreference}
          language={proposalData.language}
          onLengthChange={(value) => updateProposalData({ lengthPreference: value })}
          onLanguageChange={(value) => updateProposalData({ language: value })}
        />

        <AIModelSelector
          value={proposalData.aiModel ?? "gpt-4o"}
          onChange={(value) => updateProposalData({ aiModel: value })}
        />

        <div className="page-footer">
          <div className="page-footer-left">
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
          </div>
          <div className="page-footer-right">
            <Button variant="secondary" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button variant="primary" onClick={handleNext}>
              Next: Review &amp; Generate
            </Button>
          </div>
        </div>
    </PageLayout>
  );
}
