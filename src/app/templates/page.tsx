"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import styles from "./page.module.scss";

import Sidebar from "@/components/common/Sidebar";
import { PROPOSAL_TEMPLATES, SECTION_DISPLAY_NAMES } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import { parseCustomTemplate } from "@/api/proposalApi";
import type { ExtractedTemplateSection } from "@/api/proposalApi";

type SelectionMode = "predefined" | "scratch" | "upload";

export default function TemplatesPage(): JSX.Element {
  const { proposalData, updateProposalData, setCurrentStep } = useProposal();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track which mode/template is selected
  const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(
    () => {
      if (proposalData.templateType === "custom") return "upload";
      if (proposalData.templateType === "predefined" && proposalData.templateId)
        return "predefined";
      if (proposalData.templateType === "scratch") return "scratch";
      return null;
    }
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    proposalData.templateId
  );

  // Upload / parsing state
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [extractedSections, setExtractedSections] = useState<
    ExtractedTemplateSection[]
  >(
    () =>
      proposalData.templateType === "custom"
        ? Object.entries(proposalData.sectionDisplayNames).map(
            ([key, label]) => ({ key, label, description: "" })
          )
        : []
  );

  function handleSelectPredefined(id: string): void {
    setSelectionMode("predefined");
    setSelectedTemplateId((prev) => (prev === id ? null : id));
    if (selectedTemplateId === id) {
      setSelectionMode(null);
    }
    setExtractedSections([]);
  }

  function handleSelectScratch(): void {
    setSelectionMode((prev) => (prev === "scratch" ? null : "scratch"));
    setSelectedTemplateId(null);
    setExtractedSections([]);
  }

  function handleUploadClick(): void {
    fileInputRef.current?.click();
  }

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    // Reset input so the same file can be re-selected
    e.target.value = "";
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "docx" && ext !== "pdf") {
      toast.error("Only DOCX and PDF files are supported for template upload.");
      return;
    }

    setUploadedFileName(file.name);
    setIsParsing(true);
    setSelectionMode("upload");
    setSelectedTemplateId(null);
    setExtractedSections([]);

    try {
      const result = await parseCustomTemplate(file);
      setExtractedSections(result.sections);
      toast.success(
        `Extracted ${result.sections.length} sections from "${file.name}".`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse template file.";
      toast.error(message);
      setSelectionMode(null);
      setUploadedFileName("");
    } finally {
      setIsParsing(false);
    }
  }

  function handleNext(): void {
    if (selectionMode === "predefined" && selectedTemplateId) {
      const template = PROPOSAL_TEMPLATES.find(
        (t) => t.id === selectedTemplateId
      );
      if (template) {
        updateProposalData({
          selectedSections: [...template.sections],
          sectionDisplayNames: {},
          templateId: selectedTemplateId,
          templateType: "predefined",
        });
      }
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
    } else {
      // scratch or skip — preserve existing selections but clear template metadata
      updateProposalData({
        templateId: null,
        templateType: "scratch",
        sectionDisplayNames: {},
      });
    }

    setCurrentStep(4);
    router.push("/parameters");
  }

  function handleBack(): void {
    setCurrentStep(2);
    router.push("/knowledge-base");
  }

  const isUploadSelected = selectionMode === "upload";
  const isScratchSelected = selectionMode === "scratch";

  const selectedTemplate =
    selectionMode === "predefined" && selectedTemplateId
      ? PROPOSAL_TEMPLATES.find((t) => t.id === selectedTemplateId)
      : null;

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-badge">Phase 03</div>
        <h1 className="page-title">Step 3: Choose a Template</h1>
        <p className="page-subtitle">
          Pick a starting framework that shapes the section structure of your
          proposal. You can refine sections in the next step.
        </p>

        {/* ── Predefined Templates (top row) ── */}
        <div className="template-bento-row">
          {PROPOSAL_TEMPLATES.map((template) => {
            const isSelected =
              selectionMode === "predefined" &&
              selectedTemplateId === template.id;
            return (
              <article
                key={template.id}
                className={`tmpl-card${isSelected ? " tmpl-selected" : ""}`}
                onClick={() => handleSelectPredefined(template.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleSelectPredefined(template.id);
                }}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <div className="tmpl-selected-badge" aria-hidden="true">
                    ✓
                  </div>
                )}

                {/* Gradient preview */}
                <div
                  className={`tmpl-preview ${template.gradientClass.replace(
                    "template-card-preview-gradient",
                    "tmpl-preview-gradient"
                  )}`}
                >
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

                {/* Body */}
                <div className="tmpl-body">
                  <div className="tmpl-name">{template.name}</div>
                  <div className="tmpl-desc">{template.description}</div>
                  <div className="tmpl-sections-preview">
                    {template.sections.slice(0, 4).map((key) => (
                      <span key={key} className="badge badge-muted">
                        {SECTION_DISPLAY_NAMES[key] ?? key}
                      </span>
                    ))}
                    {template.sections.length > 4 && (
                      <span className="badge badge-muted">
                        +{template.sections.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Bottom row: Start from Scratch + Upload Custom ── */}
        <div className="template-bento-row-secondary">
          {/* Scratch */}
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
              <div className="tmpl-scratch-icon" aria-hidden="true">
                ✦
              </div>
              <div className="tmpl-scratch-label">Start from Scratch</div>
              <div className="tmpl-scratch-hint">
                Use your current section selection or let AI suggest sections
                based on your project brief.
              </div>
            </div>
          </article>

          {/* Custom Upload */}
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
              <div className="tmpl-upload-icon" aria-hidden="true">
                ⬆
              </div>
              <div className="tmpl-upload-label">
                {isUploadSelected && uploadedFileName
                  ? uploadedFileName
                  : "Upload Custom Template"}
              </div>
              <div className="tmpl-upload-hint">
                {isParsing
                  ? "Extracting sections…"
                  : "Upload a DOCX or PDF. AI extracts the section structure automatically."}
              </div>
            </div>
          </article>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf"
            style={{ display: "none" }}
            onChange={handleFileChange}
            aria-hidden="true"
          />
        </div>

        {/* ── Parsing spinner ── */}
        {isParsing && (
          <div className="tmpl-processing-pill">
            <div className="tmpl-spinner" aria-hidden="true" />
            <span>
              Parsing <strong>{uploadedFileName}</strong> — extracting section
              structure…
            </span>
          </div>
        )}

        {/* ── Extracted sections result ── */}
        {!isParsing && isUploadSelected && extractedSections.length > 0 && (
          <div className="tmpl-extracted-panel">
            <div className="tmpl-extracted-header">
              <div>
                <div className={styles.extractedTitle}>
                  Sections extracted from your template
                </div>
                <div className="tmpl-extracted-meta">
                  {uploadedFileName} · {extractedSections.length} sections
                  identified
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleUploadClick}
              >
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

        {/* ── Selection hint ── */}
        <div className={styles.selectionHint}>
          {selectedTemplate
            ? `"${selectedTemplate.name}" selected — ${selectedTemplate.sections.length} sections will be pre-applied.`
            : isUploadSelected && extractedSections.length > 0
              ? `Custom template selected — ${extractedSections.length} sections extracted.`
              : isScratchSelected
                ? "Starting from scratch — AI will suggest sections based on your brief in the next step."
                : "No template selected — your current section configuration will be preserved."}
        </div>

        <div className="page-footer">
          <div className="page-footer-left">
            <button className="btn btn-ghost" onClick={handleBack}>
              ← Back
            </button>
          </div>
          <div className="page-footer-right">
            <button
              className="btn btn-secondary"
              onClick={() => {
                updateProposalData({
                  templateId: null,
                  templateType: "scratch",
                  sectionDisplayNames: {},
                });
                setCurrentStep(4);
                router.push("/parameters");
              }}
            >
              Skip
            </button>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={isParsing}
            >
              {selectionMode === "predefined" && selectedTemplateId
                ? "Use Template & Continue →"
                : selectionMode === "upload" && extractedSections.length > 0
                  ? "Use Custom Template →"
                  : "Continue →"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
