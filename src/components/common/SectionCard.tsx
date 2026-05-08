"use client";

import { useEffect, useRef, useState } from "react";

import { SECTION_DISPLAY_NAMES } from "@/constants";
import { regenerateSection, updateSection } from "@/services/proposalApi";

interface SectionCardProps {
  proposalId: number;
  sectionKey: string;
  content: string;
  mermaidDiagram?: string;
  onContentChange: (key: string, newContent: string) => void;
}

export default function SectionCard({
  proposalId,
  sectionKey,
  content,
  mermaidDiagram,
  onContentChange,
}: SectionCardProps): JSX.Element {
  const [localContent, setLocalContent] = useState<string>(content);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [regenInstructions, setRegenInstructions] = useState<string>("");
  const [showRegenInput, setShowRegenInput] = useState<boolean>(false);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const isMermaidSection = sectionKey === "system_architecture";

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  useEffect(() => {
    if (!isMermaidSection || !mermaidDiagram || !mermaidRef.current) return;

    let cancelled = false;
    import("mermaid")
      .then((mod) => {
        if (cancelled || !mermaidRef.current) return;
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });
        const id = `mermaid-${sectionKey}-${Date.now()}`;
        mermaid
          .render(id, mermaidDiagram)
          .then(({ svg }) => {
            if (!cancelled && mermaidRef.current) {
              mermaidRef.current.innerHTML = svg;
            }
          })
          .catch(() => {
            if (!cancelled && mermaidRef.current) {
              mermaidRef.current.innerHTML =
                "<pre style='font-size:12px;overflow-x:auto'>" +
                mermaidDiagram +
                "</pre>";
            }
          });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [mermaidDiagram, isMermaidSection, sectionKey]);

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setSaveMessage("");
    try {
      await updateSection(proposalId, sectionKey, localContent);
      onContentChange(sectionKey, localContent);
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(""), 2000);
    } catch {
      setSaveMessage("Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegenerate(): Promise<void> {
    setIsRegenerating(true);
    setSaveMessage("");
    try {
      const newContent = await regenerateSection(
        proposalId,
        sectionKey,
        regenInstructions.trim() || undefined
      );
      setLocalContent(newContent);
      onContentChange(sectionKey, newContent);
      setShowRegenInput(false);
      setRegenInstructions("");
      setSaveMessage("Regenerated!");
      setTimeout(() => setSaveMessage(""), 2000);
    } catch {
      setSaveMessage("Regeneration failed.");
    } finally {
      setIsRegenerating(false);
    }
  }

  const displayName =
    SECTION_DISPLAY_NAMES[sectionKey] ?? sectionKey.replace(/_/g, " ");

  return (
    <div className="section-card" id={`section-${sectionKey}`}>
      <div className="section-card-header">
        <h2 className="section-card-title">{displayName}</h2>
        <div className="section-card-actions">
          {saveMessage && (
            <span
              className={`badge ${saveMessage.includes("fail") ? "badge-warning" : "badge-success"}`}
            >
              {saveMessage}
            </span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowRegenInput((v) => !v)}
            title="Regenerate section"
          >
            {isRegenerating ? (
              <span className="spinner spinner-14" />
            ) : (
              "↻ Regenerate"
            )}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="spinner spinner-white spinner-14" />
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {isMermaidSection && mermaidDiagram && (
        <div className="mermaid-container">
          <span className="mermaid-label">System Architecture Diagram</span>
          <div ref={mermaidRef} />
        </div>
      )}

      {showRegenInput && (
        <div className="regen-input-panel">
          <label className="form-label regen-input-label">
            Additional Instructions (optional)
          </label>
          <div className="regen-input-row">
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Focus more on scalability and cloud infrastructure..."
              value={regenInstructions}
              onChange={(e) => setRegenInstructions(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <span className="spinner spinner-white spinner-14" />
              ) : (
                "Go"
              )}
            </button>
          </div>
        </div>
      )}

      <textarea
        className="section-card-content"
        value={localContent}
        onChange={(e) => setLocalContent(e.target.value)}
        rows={8}
      />
    </div>
  );
}
