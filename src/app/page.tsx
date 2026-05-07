"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

import styles from "./page.module.scss";

import { PROPOSAL_TEMPLATES, SPECIAL_CARDS, SECTION_DISPLAY_NAMES } from "@/constants";
import { listClientsWithDocuments, getCachedClientsWithDocuments, invalidateClientsCache } from "@/api/clientApi";
import type { ClientWithDocuments } from "@/api/clientApi";
import { useProposal } from "@/context/ProposalContext";
import DynamicPipeline from "@/components/common/DynamicPipeline";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";

// Eagerly warm the client cache the moment this page module is loaded.
// By the time the user reads the page and clicks a template, the fetch is
// already in-flight (or complete), eliminating the "Loading clients..." state.
listClientsWithDocuments().catch(() => {});

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

const TemplateSelectionModal = dynamic(() => import("@/components/modals/TemplateSelectionModal"), {
  ssr: false,
});

const NewClientModal = dynamic(() => import("@/components/modals/NewClientModal"), {
  ssr: false,
});

const RecreateTemplateModal = dynamic(
  () => import("@/components/modals/RecreateTemplateModal"),
  { ssr: false }
);

type SelectionMode = "template" | "scratch" | "recreate";

export default function HomePage(): JSX.Element {
  const { updateProposalData, setCurrentStep, proposalData, draftStage, completedSteps } = useProposal();
  const router = useRouter();

  // Enable auto-save to localStorage drafts when user is on home page
  useDraftAutoSave({ enabled: true });

  const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);
  const [showRecreateModal, setShowRecreateModal] = useState<boolean>(false);
  const [preloadedClients, setPreloadedClients] = useState<ClientWithDocuments[] | null>(
    getCachedClientsWithDocuments()
  );
  const [newClientData, setNewClientData] = useState<{
    client: { id: number; name: string };
    notes: string;
    uploadedFiles: File[];
  } | null>(null);
  const [enableTemplateSelection, setEnableTemplateSelection] = useState<boolean>(false);

  const prefetchClients = useCallback(async (): Promise<void> => {
    try {
      const clientsWithDocs = await listClientsWithDocuments();
      setPreloadedClients(clientsWithDocs);
    } catch {
      setPreloadedClients([]);
    }
  }, []);

  useEffect(() => {
    prefetchClients();
  }, [prefetchClients]);

  const showPipeline = draftStage !== "template_selection" && Boolean(proposalData.title && proposalData.clientId);

  function handleSelectTemplate(id: string): void {
    setSelectedTemplateId(id);
    setShowTemplateModal(true);
  }

  function handleCloseTemplateModal(): void {
    setShowTemplateModal(false);
    setSelectedTemplateId(null);
    setSelectionMode(null);
    setNewClientData(null);
    setEnableTemplateSelection(false);
  }

  function handleNewClientFromModal(): void {
    setShowTemplateModal(false);
    setShowNewClientModal(true);
  }

  function handleClientCreated(client: { id: number; name: string }, notes: string, uploadedFiles: File[]): void {
    setShowNewClientModal(false);
    invalidateClientsCache(); // Force fresh fetch so new client appears
    prefetchClients(); // Background re-fetch — modal syncs via prop update + useEffect
    setNewClientData({ client, notes, uploadedFiles });
    setEnableTemplateSelection(true);
    setShowTemplateModal(true);
  }

  function handleSelectScratch(): void {
    setSelectionMode("scratch");
    setSelectedTemplateId(null);
    setShowTemplateModal(true);
  }

  const isScratchSelected = selectionMode === "scratch";
  const isRecreateSelected = selectionMode === "recreate";

  return (
    <div className="app-container">
      <MainSidebar />
      <main className="main-content">
        <DynamicPipeline
          currentStage={draftStage}
          completedSteps={completedSteps}
          visible={false}
        />
        
        <h1 className="page-title">Choose Your Proposal Type</h1>
        <p className="page-subtitle">
          Select a template that matches your project needs, or start from scratch with AI-powered guidance.
        </p>

        <div className="template-bento-row">
          {PROPOSAL_TEMPLATES.map((template) => {
            const isSelected = selectionMode === "template" && selectedTemplateId === template.id;
            return (
              <article
                key={template.id}
                className={`tmpl-card${isSelected ? " tmpl-selected" : ""}`}
                onClick={() => handleSelectTemplate(template.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleSelectTemplate(template.id);
                }}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <div className="tmpl-selected-badge" aria-hidden="true">
                    ✓
                  </div>
                )}

                <div className={`tmpl-preview ${template.gradientClass}`}>
                  <div className={`tmpl-preview-lines ${styles.previewLines}`} aria-hidden="true">
                    <div className="tmpl-preview-line" />
                    <div className="tmpl-preview-line" />
                    <div className="tmpl-preview-line" />
                    <div className="tmpl-preview-line" />
                  </div>
                  <span className="tmpl-preview-icon" aria-hidden="true">
                    {template.name}
                  </span>
                </div>

                <div className="tmpl-body">
                  <div className="tmpl-desc">{template.description}</div>
                  <div className="tmpl-sections-preview">
                    {template.sections.slice(0, 3).map((key) => (
                      <span key={key} className="badge badge-muted">
                        {SECTION_DISPLAY_NAMES[key] ?? key}
                      </span>
                    ))}
                    {template.sections.length > 3 && (
                      <span className="badge badge-muted">
                        +{template.sections.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
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
            onNewClient={() => {
              setShowRecreateModal(false);
              setShowNewClientModal(true);
            }}
          />
        )}

        {showTemplateModal && (selectedTemplateId || selectionMode === "scratch" || newClientData) && (
          <TemplateSelectionModal
            templateId={selectedTemplateId ?? null}
            templateName={
              selectedTemplateId
                ? PROPOSAL_TEMPLATES.find((t) => t.id === selectedTemplateId)?.name || ""
                : ""
            }
            isScratch={selectionMode === "scratch"}
            onClose={handleCloseTemplateModal}
            onNewClient={handleNewClientFromModal}
            initialClients={preloadedClients ?? undefined}
            newClientData={newClientData ?? undefined}
            enableTemplateSelection={enableTemplateSelection}
          />
        )}

        {showNewClientModal && (
          <NewClientModal
            onClose={() => setShowNewClientModal(false)}
            onClientCreated={handleClientCreated}
            existingClients={preloadedClients?.map((c) => ({ id: c.id, name: c.name })) ?? []}
          />
        )}
      </main>
    </div>
  );
}
