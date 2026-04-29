"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";

import { PROPOSAL_TEMPLATES, SPECIAL_CARDS, SECTION_DISPLAY_NAMES } from "@/constants";
import { listClientsWithDocuments, getCachedClientsWithDocuments, invalidateClientsCache } from "@/api/clientApi";
import type { ClientWithDocuments } from "@/api/clientApi";
import { useProposal } from "@/context/ProposalContext";
import { parseCustomTemplate } from "@/api/proposalApi";
import type { ExtractedTemplateSection } from "@/api/proposalApi";
import DynamicPipeline from "@/components/common/DynamicPipeline";

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

type SelectionMode = "template" | "scratch" | "upload" | "recreate";

export default function HomePage(): JSX.Element {
  const { updateProposalData, setCurrentStep, proposalData, draftStage, completedSteps } = useProposal();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseProgress, setParseProgress] = useState<number>(0);
  const [extractedSections, setExtractedSections] = useState<ExtractedTemplateSection[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);
  const [showRecreateModal, setShowRecreateModal] = useState<boolean>(false);
  const [preloadedClients, setPreloadedClients] = useState<ClientWithDocuments[] | null>(
    getCachedClientsWithDocuments()
  );

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
  }

  function handleNewClientFromModal(): void {
    setShowTemplateModal(false);
    setShowNewClientModal(true);
  }

  function handleClientCreated(): void {
    setShowNewClientModal(false);
    invalidateClientsCache(); // Force fresh fetch so new client appears
    prefetchClients(); // Background re-fetch — modal syncs via prop update + useEffect
    if (selectedTemplateId || selectionMode === "scratch") {
      setShowTemplateModal(true);
    }
  }

  function handleSelectScratch(): void {
    setSelectionMode("scratch");
    setSelectedTemplateId(null);
    setExtractedSections([]);
    setShowTemplateModal(true);
  }

  function handleUploadClick(): void {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    e.target.value = "";
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "docx" && ext !== "pdf") {
      toast.error("Only DOCX and PDF files are supported for template upload.");
      return;
    }

    setUploadedFileName(file.name);
    setIsParsing(true);
    setParseProgress(5);
    setSelectionMode("upload");
    setSelectedTemplateId(null);
    setExtractedSections([]);

    const progressInterval = setInterval(() => {
      setParseProgress((prev) => {
        if (prev >= 88) {
          clearInterval(progressInterval);
          return 88;
        }
        return prev + Math.floor(Math.random() * 8) + 3;
      });
    }, 600);

    try {
      const result = await parseCustomTemplate(file);
      clearInterval(progressInterval);
      setParseProgress(100);
      setExtractedSections(result.sections);
      toast.success(`Extracted ${result.sections.length} sections from "${file.name}".`);
    } catch (err) {
      clearInterval(progressInterval);
      const message = err instanceof Error ? err.message : "Failed to parse template file.";
      toast.error(message);
      setSelectionMode(null);
      setUploadedFileName("");
      setParseProgress(0);
    } finally {
      setIsParsing(false);
    }
  }

  function handleContinue(): void {
    if (selectionMode === "template" && selectedTemplateId) {
      const template = PROPOSAL_TEMPLATES.find((t) => t.id === selectedTemplateId);
      if (template) {
        updateProposalData({
          selectedSections: [...template.sections],
          sectionDisplayNames: {},
          templateId: selectedTemplateId,
          templateType: "predefined",
        });
      }
      setCurrentStep(1);
      router.push("/parameters");
    } else if (selectionMode === "upload" && extractedSections.length > 0) {
      const sectionKeys = extractedSections.map((s) => s.key);
      const displayNames: Record<string, string> = {};
      for (const s of extractedSections) {
        displayNames[s.key] = s.label;
      }
      updateProposalData({
        selectedSections: sectionKeys,
        sectionDisplayNames: displayNames,
        templateId: null,
        templateType: "custom",
      });
      setCurrentStep(1);
      router.push("/parameters");
    } else if (selectionMode === "scratch") {
      updateProposalData({
        templateId: null,
        templateType: "scratch",
        sectionDisplayNames: {},
      });
      setCurrentStep(1);
      router.push("/parameters");
    }
  }

  const isUploadSelected = selectionMode === "upload";
  const isScratchSelected = selectionMode === "scratch";
  const isRecreateSelected = selectionMode === "recreate";

  return (
    <div className="app-container">
      <MainSidebar />
      <main className="main-content">
        <DynamicPipeline 
          currentStage={draftStage}
          completedSteps={completedSteps}
          visible={showPipeline}
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
                    {template.icon}
                  </span>
                </div>

                <div className="tmpl-body">
                  <div className="tmpl-name">{template.name}</div>
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
            className={`tmpl-card tmpl-upload${isUploadSelected ? " tmpl-selected" : ""}`}
            onClick={handleUploadClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleUploadClick();
            }}
            aria-label="Upload a custom DOCX or PDF template"
          >
            {isUploadSelected && !isParsing && (
              <div className="tmpl-selected-badge" aria-hidden="true">
                ✓
              </div>
            )}
            <div className="tmpl-upload-inner">
              <div className="tmpl-upload-icon">{SPECIAL_CARDS.CUSTOM_TEMPLATE.icon}</div>
              <div className="tmpl-upload-label">
                {isUploadSelected && uploadedFileName ? uploadedFileName : SPECIAL_CARDS.CUSTOM_TEMPLATE.name}
              </div>
              <div className="tmpl-upload-hint">
                {isParsing ? "Extracting sections…" : SPECIAL_CARDS.CUSTOM_TEMPLATE.description}
              </div>
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf"
            style={{ display: "none" }}
            onChange={handleFileChange}
            aria-hidden="true"
          />
        </div>

        {isParsing && (
          <div className="tmpl-processing-pill" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <div className="tmpl-spinner" aria-hidden="true" />
              <span>
                Parsing <strong>{uploadedFileName}</strong> — scanning for section structure…
              </span>
              <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 13 }}>
                {parseProgress}%
              </span>
            </div>
            <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${parseProgress}%`,
                  background: "var(--color-primary)",
                  borderRadius: 3,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        )}

        {!isParsing && isUploadSelected && extractedSections.length > 0 && (
          <div className="tmpl-extracted-panel">
            <div className="tmpl-extracted-header">
              <div>
                <div className={styles.extractedTitle}>Sections extracted from your template</div>
                <div className="tmpl-extracted-meta">
                  {uploadedFileName} · {extractedSections.length} sections identified
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleUploadClick}>
                Replace file
              </button>
            </div>
            <ul className="tmpl-extracted-sections-list" role="list">
              {extractedSections.map((s) => (
                <li key={s.key} className="tmpl-extracted-section-row">
                  <span className="tmpl-extracted-check" aria-hidden="true">
                    ✓
                  </span>
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        )}

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
            onNewClient={handleNewClientFromModal}
            initialClients={preloadedClients ?? undefined}
          />
        )}

        {showNewClientModal && (
          <NewClientModal
            onClose={() => setShowNewClientModal(false)}
            onClientCreated={handleClientCreated}
          />
        )}
      </main>
    </div>
  );
}
