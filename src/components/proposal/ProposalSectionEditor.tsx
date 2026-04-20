"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { plainTextToHtml } from "@/utils/contentParser";
import ContentRenderer from "./ContentRenderer";

const RichEditor = dynamic(() => import("@/components/common/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="rte-content text-light">
      Loading editor…
    </div>
  ),
});

interface ProposalSectionEditorProps {
  sectionKey: string;
  label: string;
  rawContent: string;
  /** Mermaid diagram code — provided only for diagram-type sections. */
  mermaidCode?: string;
  onContentChange: (key: string, html: string) => void;
  onSave: (key: string, content: string) => Promise<void>;
  onRegenerate: (key: string, instructions?: string) => Promise<string | null>;
}

/**
 * Renders a single proposal section with view / edit modes,
 * save, and AI regeneration controls.
 *
 * View mode: delegates to ContentRenderer which picks the correct renderer
 *   (table, bullets, diagram, or paragraph) based on content type.
 *
 * Edit mode: converts plain-text content to HTML before loading TipTap so the
 *   editor receives properly structured markup regardless of whether the
 *   content is freshly AI-generated (plain text) or previously edited (HTML).
 */
export default function ProposalSectionEditor({
  sectionKey,
  label,
  rawContent,
  mermaidCode,
  onContentChange,
  onSave,
  onRegenerate,
}: ProposalSectionEditorProps): JSX.Element {
  const [localContent, setLocalContent] = useState<string>(rawContent);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [showRegenInput, setShowRegenInput] = useState<boolean>(false);
  const [regenInstructions, setRegenInstructions] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    setLocalContent(rawContent);
  }, [rawContent]);

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    await onSave(sectionKey, localContent);
    setIsSaving(false);
    setIsEditing(false);
  }

  async function handleRegenerate(): Promise<void> {
    setIsRegenerating(true);
    const result = await onRegenerate(sectionKey, regenInstructions || undefined);
    if (result !== null) {
      setLocalContent(result);
      setShowRegenInput(false);
      setRegenInstructions("");
      setIsEditing(false);
    }
    setIsRegenerating(false);
  }

  function handleEditorChange(html: string): void {
    setLocalContent(html);
    onContentChange(sectionKey, html);
  }

  /** Convert content to HTML before opening TipTap so it receives valid markup. */
  const editorContent = plainTextToHtml(localContent);

  return (
    <div className="proposal-page" id={`section-${sectionKey}`}>
      <div className="proposal-page-header">
        <h2 className="proposal-page-title">{label}</h2>
        <div className="proposal-page-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowRegenInput((v) => !v)}
            title="Regenerate with AI"
          >
            {isRegenerating ? (
              <span className="spinner spinner-sm" />
            ) : (
              "↻ Regenerate"
            )}
          </button>
          {isEditing ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="spinner spinner-white spinner-sm" />
              ) : (
                "Save"
              )}
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditing(true)}
              disabled={isRegenerating}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {showRegenInput && (
        <div className="regen-bar">
          <input
            className="form-input flex-1 font-13"
            placeholder="Optional instructions, e.g. focus more on ROI…"
            value={regenInstructions}
            onChange={(e) => setRegenInstructions(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRegenerate();
            }}
            disabled={isRegenerating}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            Go
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setShowRegenInput(false);
              setRegenInstructions("");
            }}
            disabled={isRegenerating}
          >
            Cancel
          </button>
        </div>
      )}

      {isEditing ? (
        <RichEditor
          content={editorContent}
          onChange={handleEditorChange}
          placeholder={`Write the ${label} section here…`}
        />
      ) : (
        <div className="cursor-text" onClick={() => setIsEditing(true)}>
          <ContentRenderer
            sectionKey={sectionKey}
            content={localContent}
            mermaidCode={mermaidCode}
          />
        </div>
      )}
    </div>
  );
}
