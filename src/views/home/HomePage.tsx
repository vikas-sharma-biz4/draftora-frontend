"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";

import styles from "./HomePage.module.scss";

import { PROPOSAL_TEMPLATES, SPECIAL_CARDS, SECTION_DISPLAY_NAMES } from "@/constants";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import {
  useProposalTitle,
  useClientId,
  useCurrentStep,
  useWizardActions,
} from "@/store/features/wizard/proposalWizardSlice";
import DynamicPipeline from "@/components/common/DynamicPipeline";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";
import { useClients } from "@/hooks/useClients";

const PageLayout = dynamic(() => import("@/layouts/AppLayout"), { ssr: false });

const TemplateSelectionModal = dynamic(() => import("@/components/modals/TemplateSelectionModal/TemplateSelectionModal"), {
  ssr: false,
});

const RecreateTemplateModal = dynamic(
  () => import("@/components/modals/RecreateTemplateModal"),
  { ssr: false }
);

type SelectionMode = "template" | "scratch" | "recreate";

export default function HomePage(): JSX.Element {
  const title = useProposalTitle();
  const clientId = useClientId();
  const currentStep = useCurrentStep();
  const { updateProposalData, setCurrentStep } = useWizardActions();
  const draftStage = useDraftSessionStore((s) => s.draftStage);
  const completedSteps = useDraftSessionStore((s) => s.completedSteps);
  const setCurrentDraftId = useDraftSessionStore((s) => s.setCurrentDraftId);
  const router = useRouter();

  const hasMeaningfulData = Boolean(title && clientId);
  useDraftAutoSave({ enabled: hasMeaningfulData });

  const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showRecreateModal, setShowRecreateModal] = useState<boolean>(false);
  const { clients: preloadedClients, refetch: refetchClients } = useClients({ autoFetch: false });
  const hasFetchedClients = useRef(false);

  // Fetch clients on home page load (only once)
  useEffect(() => {
    if (!hasFetchedClients.current) {
      hasFetchedClients.current = true;
      refetchClients();
    }
  }, []);

  const showPipeline = draftStage !== "template_selection" && Boolean(title && clientId);

  function handleSelectTemplate(id: string): void {
    setSelectedTemplateId(id);
    setCurrentDraftId(null); // Clear draft ID for new proposal
    setShowTemplateModal(true);
  }

  function handleCloseTemplateModal(): void {
    setShowTemplateModal(false);
    setSelectedTemplateId(null);
    setSelectionMode(null);
  }

  function handleSelectScratch(): void {
    setSelectionMode("scratch");
    setSelectedTemplateId(null);
    setCurrentDraftId(null); // Clear draft ID for new proposal
    setShowTemplateModal(true);
  }

  const isScratchSelected = selectionMode === "scratch";
  const isRecreateSelected = selectionMode === "recreate";

  return (
    <PageLayout noPadding>
      <DynamicPipeline
        currentStage={draftStage}
        completedSteps={completedSteps}
        visible={false}
      />
      <h1 className={`page-title ${styles.pageTitle}`}>Choose Your Proposal Type</h1>
        <p className={`page-subtitle ${styles.pageSubtitle}`}>
          Select a template that matches your project needs, or start from scratch with AI-powered guidance.
        </p>

        <div className="template-bento-row">
          {PROPOSAL_TEMPLATES.map((template) => {
            const isSelected = selectionMode === "template" && selectedTemplateId === template.id;
            return (
              <article
                key={template.id}
                className={`tmpl-card-new${isSelected ? " tmpl-card-selected" : ""}`}
                onClick={() => handleSelectTemplate(template.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleSelectTemplate(template.id);
                }}
                aria-pressed={isSelected}
              >
                <div className="tmpl-card-top-bar"></div>

                <div className="tmpl-card-header">
                  <span className="tmpl-card-badge">{template.category}</span>
                </div>

                <h3 className="tmpl-card-title">{template.name}</h3>
                <p className="tmpl-card-description">{template.description}</p>

                <div className="tmpl-card-architecture">
                  <p className="tmpl-card-architecture-label">Architecture</p>
                  <div className="tmpl-card-tags">
                    {template.sections.slice(0, 3).map((key) => (
                      <span key={key} className="tmpl-card-tag">
                        {SECTION_DISPLAY_NAMES[key] ?? key}
                      </span>
                    ))}
                    {template.sections.length > 3 && (
                      <span className="tmpl-card-tag">
                        +{template.sections.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <button className="tmpl-card-button">Select Template</button>
              </article>
            );
          })}
        </div>

        <div className="template-bento-row-secondary">
          <article
            className={`tmpl-card tmpl-scratch${isScratchSelected ? " tmpl-selected" : ""}`}
            onClick={handleSelectScratch}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleSelectScratch();
            }}
            aria-pressed={isScratchSelected}
          >
            {isScratchSelected && (
              <div className="tmpl-selected-badge" aria-hidden="true">
                ✓
              </div>
            )}
            <div className="tmpl-scratch-inner">
              <div className="tmpl-scratch-icon">{SPECIAL_CARDS.START_FROM_SCRATCH.icon}</div>
              <div className="tmpl-scratch-label">{SPECIAL_CARDS.START_FROM_SCRATCH.name}</div>
              <div className="tmpl-scratch-hint">{SPECIAL_CARDS.START_FROM_SCRATCH.description}</div>
            </div>
          </article>

          <article
            className={`tmpl-card tmpl-recreate${isRecreateSelected ? " tmpl-selected" : ""}`}
            onClick={() => {
              setSelectionMode("recreate");
              setShowRecreateModal(true);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setSelectionMode("recreate");
                setShowRecreateModal(true);
              }
            }}
            aria-label="Recreate an existing document with new context"
          >
            <div className="tmpl-upload-inner">
              <div className="tmpl-upload-icon">{SPECIAL_CARDS.RECREATE_TEMPLATE.icon}</div>
              <div className="tmpl-upload-label">{SPECIAL_CARDS.RECREATE_TEMPLATE.name}</div>
              <div className="tmpl-upload-hint">{SPECIAL_CARDS.RECREATE_TEMPLATE.description}</div>
            </div>
          </article>

        </div>

        {showRecreateModal && (
          <RecreateTemplateModal
            onClose={() => {
              setShowRecreateModal(false);
              setSelectionMode(null);
            }}
          />
        )}

        {showTemplateModal && (selectedTemplateId || selectionMode === "scratch") && (
          <TemplateSelectionModal
            templateId={selectedTemplateId ?? null}
            templateName={
              selectedTemplateId
                ? PROPOSAL_TEMPLATES.find((t) => t.id === selectedTemplateId)?.name || ""
                : ""
            }
            isScratch={selectionMode === "scratch"}
            onClose={handleCloseTemplateModal}
            initialClients={preloadedClients ?? undefined}
          />
        )}
    </PageLayout>
  );
}
