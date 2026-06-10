"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import dynamic from "next/dynamic";
import Button from "@/components/common/Button";
import { getProposal } from "@/services/proposal.service";

import type { ProposalData } from "@/interfaces/proposalInterfaces";
import {
  useTemplateType,
  useTemplateId,
  useSelectedSections,
  useSectionDisplayNames,
  useTone,
  useLengthPreference,
  useLanguage,
  useAiModel,
  useExactDocumentName,
  useOriginalSections,
  useContextualInstructions,
  useFilesMeta,
  useCurrentStep,
  useIsGenerating,
  useCurrentProposalId,
  useEditMode,
  useMaxStepReached,
  useWizardActions,
  useApprovalStatus,
  useProposalTitle,
  useClientName,
} from "@/store/features/wizard/proposalWizardSlice";
import { useDraftSessionStore } from "@/store/hooks";
import { usePipelineSteps } from "@/hooks/usePipelineSteps";
import { usePipelineStore } from "@/store/features/pipeline/pipelineSlice";
import { useProposalWizardStore } from "@/store/features/wizard/proposalWizardSlice";
import { useShallow } from "zustand/react/shallow";
import type { SectionItem } from "@/components/common/SortableSectionList";
import { useWizardAutoSave } from "@/hooks/useWizardAutoSave";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { SECTION_DISPLAY_NAMES, TEMPLATE_TOCS } from "@/constants";
import { DRAFT_UI_STATE_STORAGE_KEY } from "@/constants/storageKeys";

import SectionRecommendations, {
  type SectionRecommendationsRef,
} from "@/components/proposal/SectionRecommendations";
import type { SectionRecommendation } from "@/services/proposal.service";
import SectionManager from "./SectionManager";
import ToneSelector from "./ToneSelector";
import LengthLanguageSelector from "./LengthLanguageSelector";

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

function getTemplateSections(templateType: string): SectionItem[] {
  // Get sections from TEMPLATE_TOCS based on template type
  if (templateType === "mvp" && TEMPLATE_TOCS.mvp) {
    return TEMPLATE_TOCS.mvp.map((section: { key: string; label: string }) => ({
      key: section.key,
      label: section.label,
    }));
  }
  if (templateType === "design" && TEMPLATE_TOCS.design) {
    return TEMPLATE_TOCS.design.map((section: { key: string; label: string }) => ({
      key: section.key,
      label: section.label,
    }));
  }
  if (templateType === "poc" && TEMPLATE_TOCS.poc) {
    return TEMPLATE_TOCS.poc.map((section: { key: string; label: string }) => ({
      key: section.key,
      label: section.label,
    }));
  }
  // Fallback for scratch or custom templates
  return [];
}

export default function ParametersPage(): JSX.Element {
  const templateType = useTemplateType();
  const templateId = useTemplateId();
  const proposalTitle = useProposalTitle();
  const clientName = useClientName();
  const selectedSections = useSelectedSections();
  const sectionDisplayNames = useSectionDisplayNames();
  const tone = useTone();
  const lengthPreference = useLengthPreference();
  const language = useLanguage();
  const aiModel = useAiModel();
  const exactDocumentName = useExactDocumentName();
  const originalSections = useOriginalSections();
  const contextualInstructions = useContextualInstructions();
  const filesMeta = useFilesMeta();
  const currentStep = useCurrentStep();
  const isGenerating = useIsGenerating();
  const currentProposalId = useCurrentProposalId();
  const editMode = useEditMode();
  const maxStepReached = useMaxStepReached();
  const approvalStatus = useApprovalStatus();
  const {
    updateProposalData,
    setCurrentStep,
    setIsGenerating,
    setGeneratedProposalId,
    setEditMode,
    setMaxStepReached,
    setCurrentProposalId,
  } = useWizardActions();
  const { visitedPipelineSteps, syncVisitedStepsFromBackend, markStepVisitedOnBackend } =
    usePipelineSteps();
  const draftStage = useDraftSessionStore((s) => s.draftStage);
  const completedSteps = useDraftSessionStore((s) => s.completedSteps);
  const setDraftStage = useDraftSessionStore((s) => s.setDraftStage);
  const setCompletedSteps = useDraftSessionStore((s) => s.setCompletedSteps);
  const markStepCompleted = useDraftSessionStore((s) => s.markStepCompleted);
  const router = useRouter();
  const searchParams = useSearchParams();
  const handleSaveDraft = useSaveDraft();
  const isRegenerating = currentProposalId !== null;
  const isRecreateMode = templateType === "recreate";

  // Enable auto-save when user is in pipeline stage
  useWizardAutoSave({ enabled: true, debounceMs: 2000, approvalStatus });

  // Restore currentProposalId from URL params if not set in store
  useEffect(() => {
    const urlProposalId = searchParams.get("proposalId");
    if (urlProposalId && !currentProposalId) {
      setCurrentProposalId(Number(urlProposalId));
    }
  }, [searchParams, currentProposalId, setCurrentProposalId]);

  // Fetch proposal data when viewing from History to get approvalStatus
  useEffect(() => {
    const urlProposalId = searchParams.get("proposalId");
    if (urlProposalId || currentProposalId) {
      const proposalIdToFetch = Number(urlProposalId) || currentProposalId;
      if (proposalIdToFetch) {
        getProposal(proposalIdToFetch)
          .then((data: ProposalData) => {
            if (data?.approvalStatus) {
              updateProposalData({ approvalStatus: data.approvalStatus });
            }
          })
          .catch((error: unknown) => {
            logger.warn("[ParametersPage] Failed to fetch proposal for approvalStatus", error);
          });
      }
    }
  }, [searchParams, currentProposalId, updateProposalData]);

  // Sync visited steps from backend on mount
  useEffect(() => {
    if (currentProposalId) {
      syncVisitedStepsFromBackend(currentProposalId);
    }
  }, [currentProposalId, syncVisitedStepsFromBackend]);

  // For already-generated proposals (coming from History with proposalId in URL), immediately mark all steps as visited
  // This ensures the pipeline shows correct state even before backend sync completes
  useEffect(() => {
    const urlProposalId = searchParams.get("proposalId");
    if (urlProposalId || currentProposalId) {
      // This is viewing an existing proposal - mark all steps as visited
      const { markStepAsVisited } = usePipelineStore.getState();
      let needsUpdate = false;

      if (!visitedPipelineSteps.includes(1)) {
        markStepAsVisited(1);
        needsUpdate = true;
      }
      if (!visitedPipelineSteps.includes(2)) {
        markStepAsVisited(2);
        needsUpdate = true;
      }
      if (!visitedPipelineSteps.includes(3)) {
        markStepAsVisited(3);
        needsUpdate = true;
      }

      // Set draft stage to generated to enable full pipeline navigation
      setDraftStage("generated");
      setCompletedSteps([1, 2, 3]);
      setMaxStepReached(3);

      // Sync to backend if we have a proposalId and made local updates
      const proposalIdToSync = Number(urlProposalId) || currentProposalId;
      if (needsUpdate && proposalIdToSync) {
        markStepVisitedOnBackend(proposalIdToSync, 1);
        markStepVisitedOnBackend(proposalIdToSync, 2);
        markStepVisitedOnBackend(proposalIdToSync, 3);
      }
    }
  }, [
    searchParams,
    currentProposalId,
    visitedPipelineSteps,
    markStepVisitedOnBackend,
    usePipelineStore,
    setDraftStage,
    setCompletedSteps,
    setMaxStepReached,
  ]);

  // Compute sections from templateType - DERIVED STATE (not stored)
  const computedSections = useMemo(() => {
    // If it's a template type with predefined TOC (mvp, design, poc), always use those sections
    if (templateType && ["mvp", "design", "poc"].includes(templateType)) {
      const templateSections = getTemplateSections(templateType);
      if (templateSections.length > 0) {
        logger.info("[ParametersPage] computedSections: using template sections", {
          templateType,
          count: templateSections.length,
        });
        return templateSections;
      }
    }
    // Otherwise, use the existing sections from proposalData or recreate mode
    const built = buildSectionItems(selectedSections, sectionDisplayNames, originalSections);
    logger.info("[ParametersPage] computedSections: built from store", {
      selectedSectionsCount: selectedSections.length,
      builtCount: built.length,
    });
    return built;
  }, [templateType, selectedSections, sectionDisplayNames, originalSections]);

  const [sections, setSections] = useState<SectionItem[]>(computedSections);
  const [hasModifiedSections, setHasModifiedSections] = useState<boolean>(false);

  // Memoize sections to prevent unnecessary re-renders of SortableSectionList
  const memoizedSections = useMemo(() => sections, [sections]);

  // Sync local state with computed sections when templateType changes
  useEffect(() => {
    // Skip syncing if we're in the process of resetting (selectedSections are empty)
    if (!selectedSections || selectedSections.length === 0) {
      return;
    }
    // Only sync from computedSections if templateType is a predefined template
    // For scratch/custom modes, trust the local sections state completely
    if (templateType && ["mvp", "design", "poc"].includes(templateType)) {
      const templateSections = getTemplateSections(templateType);
      if (templateSections.length > 0) {
        // Only sync if sections is empty (initial load) or if templateType just changed
        // AND the user hasn't made manual modifications
        if (
          sections.length === 0 ||
          (!hasModifiedSections &&
            JSON.stringify(sections.map((s) => s.key)) !==
              JSON.stringify(templateSections.map((s) => s.key)))
        ) {
          logger.info("[ParametersPage] Syncing from template sections", {
            templateType,
            templateCount: templateSections.length,
            currentCount: sections.length,
            hasModifiedSections,
          });
          setSections(templateSections);
          setHasModifiedSections(false);
        }
      }
    }
    // For non-template modes, DO NOT sync - trust local state completely
    // This prevents overwriting manual additions
  }, [templateType, selectedSections, sections, hasModifiedSections]);

  // Sync local sections to store when they change (for auto-save to work correctly)
  useEffect(() => {
    const keys = sections.map((s) => s.key);
    const displayNames: Record<string, string> = {};
    for (const s of sections) {
      displayNames[s.key] = s.label;
    }
    // Only update if different from store
    const keysChanged = JSON.stringify(keys) !== JSON.stringify(selectedSections);
    const displayNamesChanged =
      JSON.stringify(displayNames) !== JSON.stringify(sectionDisplayNames);
    if (keysChanged || displayNamesChanged) {
      logger.info("[ParametersPage] Syncing local sections to store", {
        keysCount: keys.length,
        displayNamesCount: Object.keys(displayNames).length,
        keysChanged,
        displayNamesChanged,
        hasModifiedSections,
      });
      updateProposalData({
        selectedSections: keys,
        sectionDisplayNames: displayNames,
        customSections: [],
      });
    }
  }, [sections, selectedSections, sectionDisplayNames, updateProposalData]);

  // Sync computed sections to store when they change (only for non-template modes)
  // DISABLED: This causes race conditions with manual section additions
  // SectionManager now handles store updates directly via onUpdateProposalData
  // useEffect(() => {
  //   // Only sync for non-template modes (scratch, custom, recreate)
  //   // Skip syncing if we're in the process of resetting (sections are empty or selectedSections are empty)
  //   if (!templateType || ["mvp", "design", "poc"].includes(templateType)) {
  //     return;
  //   }
  //   if (!selectedSections || selectedSections.length === 0) {
  //     return;
  //   }
  //   if (!sections || sections.length === 0) {
  //     return;
  //   }
  //   const keys = sections.map((s) => s.key);
  //   const displayNames: Record<string, string> = {};
  //   for (const s of sections) {
  //     displayNames[s.key] = s.label;
  //   }
  //   // Only update if different
  //   const keysChanged = JSON.stringify(keys) !== JSON.stringify(selectedSections);
  //   const displayNamesChanged = JSON.stringify(displayNames) !== JSON.stringify(sectionDisplayNames);
  //   if (keysChanged || displayNamesChanged) {
  //     updateProposalData({
  //       selectedSections: keys,
  //       sectionDisplayNames: displayNames,
  //     });
  //   }
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [templateType, sections, selectedSections, sectionDisplayNames]);

  // Cleanup on unmount - cancel any in-flight requests
  useEffect(() => {
    return () => {
      // Cancel any in-flight recommendations fetch when navigating away
      // This prevents memory leaks and state updates after unmount
      const { cancelRecommendationsFetch } = useProposalWizardStore.getState();
      cancelRecommendationsFetch();
    };
  }, []);

  // Mark step 1 as visited when this page loads
  useEffect(() => {
    markStepCompleted(1);
  }, [markStepCompleted]);

  // Restore scroll position from draft UI state
  useEffect(() => {
    try {
      const uiStateStr = sessionStorage.getItem(DRAFT_UI_STATE_STORAGE_KEY);
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
        sessionStorage.removeItem(DRAFT_UI_STATE_STORAGE_KEY);
      }
    } catch {
      // Ignore errors restoring UI state
    }
  }, []);

  const handleSaveDraftWithSync = useCallback(async (): Promise<void> => {
    // Sync local sections state to store before saving.
    // Zustand's set is synchronous, and useSaveDraft reads via getState() at call-time,
    // so the updated values are available immediately — no delay required.
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

    await handleSaveDraft();
  }, [sections, updateProposalData, handleSaveDraft]);

  const handleNext = useCallback(async (): Promise<void> => {
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
    setCurrentStep(2);

    // Update maxStepReached to allow returning to Step 2 from Step 1
    if (maxStepReached < 2) {
      setMaxStepReached(2);
    }

    router.push("/review");

    if (isRegenerating) {
      toast.info("Parameters updated. Review and regenerate to apply changes");
    }
  }, [
    sections,
    updateProposalData,
    currentProposalId,
    markStepVisitedOnBackend,
    markStepCompleted,
    setDraftStage,
    setCurrentStep,
    maxStepReached,
    setMaxStepReached,
    router,
    isRegenerating,
  ]);

  const handleSectionsChange = useCallback(
    (newSections: SectionItem[] | ((prev: SectionItem[]) => SectionItem[])): void => {
      // Mark that user has made manual modifications
      setHasModifiedSections(true);
      setSections(newSections);
    },
    []
  );

  // ── AI Recommendations state (lifted from SectionManager so the panel can
  //    render in the right column while callbacks remain wired to the TOC) ──────
  const sectionRecommendationsRef = useRef<SectionRecommendationsRef>(null);

  const [aiRecommendedSectionsMap, setAiRecommendedSectionsMap] = useState<
    Map<string, { recommendation: SectionRecommendation; originalIndex: number }>
  >(new Map());

  const addSectionToProposal = useCallback(
    (
      sectionKey: string,
      sectionTitle: string,
      recommendation?: SectionRecommendation,
      originalIndex?: number
    ): void => {
      if (sections.some((s) => s.key === sectionKey)) {
        toast.error(`"${sectionTitle}" is already in the structure`);
        logger.warn("[ParametersPage] Section already exists, skipping add", { sectionKey });
        return;
      }
      const newSection: SectionItem = { key: sectionKey, label: sectionTitle };
      const updatedSections = [...sections, newSection];
      if (recommendation && originalIndex !== undefined) {
        setAiRecommendedSectionsMap((prev) =>
          new Map(prev).set(sectionKey, { recommendation, originalIndex })
        );
      }
      setHasModifiedSections(true);
      setSections(updatedSections);
      updateProposalData({
        selectedSections: updatedSections.map((s) => s.key),
        sectionDisplayNames: { ...sectionDisplayNames, [sectionKey]: sectionTitle },
      });
    },
    [sections, sectionDisplayNames, updateProposalData]
  );

  const handleRemoveSectionEffect = useCallback(
    (key: string): void => {
      const data = aiRecommendedSectionsMap.get(key);
      if (data) {
        sectionRecommendationsRef.current?.restoreRecommendation(
          key,
          data.recommendation,
          data.originalIndex
        );
        logger.info("[ParametersPage] Restored section to AI recommendations", {
          sectionKey: key,
          originalIndex: data.originalIndex,
        });
        setAiRecommendedSectionsMap((prev) => {
          const m = new Map(prev);
          m.delete(key);
          return m;
        });
      }
    },
    [aiRecommendedSectionsMap]
  );

  const handleRemoveFromRecommendations = useCallback((key: string): void => {
    sectionRecommendationsRef.current?.removeRecommendation(key);
  }, []);

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
      <div className="page-badge">Phase 01</div>
      <h1 className="page-title">Step 1: Table of Contents &amp; Parameters</h1>

      <p className="page-subtitle">
        {isRecreateMode
          ? "Sections extracted from your document are shown below. Reorder, rename, or add sections — each will be rewritten with the new context."
          : "Review and refine the proposal structure. Reorder, rename, or remove sections — and set the tone for the generated content."}
      </p>

      {isRecreateMode && (
        <div className="recreate-banner">
          <div>
            <strong>Recreate Mode</strong>
            {exactDocumentName && (
              <span className="recreate-banner-file"> · {exactDocumentName}</span>
            )}
            <div className="recreate-banner-hint">
              {originalSections?.length ?? 0} sections will be rewritten using new context.
            </div>
          </div>
        </div>
      )}

      <div className="parameters-outer-layout">
        <div>
          <SectionManager
            sections={memoizedSections}
            onSectionsChange={handleSectionsChange}
            proposalData={{
              templateId,
              sectionDisplayNames,
              contextualInstructions,
              exactDocumentName,
              filesMeta,
            }}
            onUpdateProposalData={updateProposalData}
            isRecreateMode={isRecreateMode}
            proposalId={currentProposalId}
            onAddSection={addSectionToProposal}
            onRemoveFromRecommendations={handleRemoveFromRecommendations}
            onRemoveSectionEffect={handleRemoveSectionEffect}
          />
        </div>

        <div className="parameters-right-col">
          <ToneSelector value={tone} onChange={(value) => updateProposalData({ tone: value })} />

          <LengthLanguageSelector
            lengthPreference={lengthPreference}
            language={language}
            aiModel={aiModel ?? "gpt-4o"}
            onLengthChange={(value) => updateProposalData({ lengthPreference: value })}
            onLanguageChange={(value) => updateProposalData({ language: value })}
            onAiModelChange={(value) => updateProposalData({ aiModel: value })}
          />

          <div className="section-recommendations-wrapper">
            <SectionRecommendations
              ref={sectionRecommendationsRef}
              templateId={templateId}
              existingSections={sections.map((s) => s.key)}
              context={contextualInstructions || ""}
              documentContext={
                (isRecreateMode ? (exactDocumentName ? exactDocumentName + ", " : "") : "") +
                (filesMeta?.map((f) => f.name).join(", ") ?? "")
              }
              onAddSection={addSectionToProposal}
              proposalId={currentProposalId}
            />
          </div>
        </div>
      </div>

      <div className="page-footer">
        <Button variant="secondary" onClick={handleSaveDraftWithSync}>
          Save Draft
        </Button>
        <div className="ml-auto">
          <Button variant="primary" onClick={handleNext}>
            Next
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
