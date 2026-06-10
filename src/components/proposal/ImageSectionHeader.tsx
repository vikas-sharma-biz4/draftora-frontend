"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { parseGeneratedImageUrls } from "@/utils/contentParser";
import { regenerateSection } from "@/services/proposal/proposalSections.service";
import { toast } from "@/utils/toast";
import Button from "@/components/common/Button";
import DiagramRenderer from "./renderers/DiagramRenderer";
import DiagramRegenerateModal from "./DiagramRegenerateModal";

interface ImageSectionHeaderProps {
  proposalId: number;
  sectionKey: string;
  label: string;
  content: string;
  onContentChange: (key: string, html: string) => void;
  onSave: (key: string, content: string) => Promise<void>;
}

/**
 * Renders an image/diagram section with:
 * - Section heading + inline "Regenerate" button
 * - Inline instruction input (single-image) or modal (multi-image)
 * - < X/N > navigation between regeneration history (session-only)
 * - DiagramRenderer to display the current or historical diagram
 */
export default function ImageSectionHeader({
  proposalId,
  sectionKey,
  label,
  content,
  onContentChange,
  onSave,
}: ImageSectionHeaderProps): JSX.Element {
  const [versionHistory, setVersionHistory] = useState<string[]>([content]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [showInput, setShowInput] = useState<boolean>(false);
  const [instructions, setInstructions] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);

  // Sync version history when content prop changes from outside.
  // If content is already tracked (e.g. from our own regeneration), keep history intact.
  useEffect(() => {
    setVersionHistory((prev) => {
      if (prev.includes(content)) return prev;
      return [content];
    });
  }, [content]);

  const imageUrls = parseGeneratedImageUrls(content);
  const isMultiImage = imageUrls.length > 1;

  // Guard against out-of-bounds index if history was externally reset
  const safeCurrentIndex = Math.min(currentIndex, versionHistory.length - 1);
  const displayedContent = versionHistory[safeCurrentIndex] ?? content;
  const totalVersions = versionHistory.length;

  const doRegenerate = useCallback(
    async (combinedInstructions?: string): Promise<void> => {
      setIsRegenerating(true);
      try {
        const newContent = await regenerateSection(proposalId, sectionKey, combinedInstructions);
        // Use functional update so we don't need versionHistory in the dep array
        setVersionHistory((prev) => {
          const newHistory = [...prev, newContent];
          setCurrentIndex(newHistory.length - 1);
          return newHistory;
        });
        onContentChange(sectionKey, newContent);
        // Re-enable the button as soon as the new diagram is visible; save is a
        // background concern and should not keep the button blocked.
        setIsRegenerating(false);
        await onSave(sectionKey, newContent);
      } catch {
        setIsRegenerating(false);
        toast.error("Failed to regenerate diagram");
      }
    },
    [proposalId, sectionKey, onContentChange, onSave]
  );

  function handleRegenerate(): void {
    const instr = instructions.trim();
    setShowInput(false);
    setInstructions("");
    void doRegenerate(instr || undefined);
  }

  function handleRegenerateMulti(imageInstructions: string[]): void {
    setShowModal(false);
    const combined = imageInstructions
      .map((instr, idx) => (instr.trim() ? `Image ${idx + 1}: ${instr.trim()}` : null))
      .filter(Boolean)
      .join("; ");
    void doRegenerate(combined || undefined);
  }

  return (
    <>
      <div className="proposal-page-header">
        <h2 className="proposal-page-title">{label}</h2>

        <div className="diagram-header-actions">
          {totalVersions > 1 && (
            <div className="diagram-version-nav">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={safeCurrentIndex === 0}
                aria-label="Previous version"
              >
                ‹
              </button>
              <span className="diagram-version-label">
                {safeCurrentIndex + 1} / {totalVersions}
              </span>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(versionHistory.length - 1, i + 1))}
                disabled={safeCurrentIndex === totalVersions - 1}
                aria-label="Next version"
              >
                ›
              </button>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="diagram-regen-btn"
            loading={isRegenerating}
            onClick={() => (isMultiImage ? setShowModal(true) : setShowInput((v) => !v))}
            disabled={isRegenerating}
          >
            {!isRegenerating && <RefreshCw size={13} />}
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      </div>

      {showInput && !isMultiImage && (
        <div className="diagram-regen-input-row">
          <input
            className="diagram-regen-input"
            placeholder="Describe changes (e.g. Add Redis cache, Remove old service)"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRegenerate();
              if (e.key === "Escape") {
                setShowInput(false);
                setInstructions("");
              }
            }}
            autoFocus
          />
          <Button variant="primary" size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
            Generate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowInput(false);
              setInstructions("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="proposal-section-content">
        <DiagramRenderer content={displayedContent} sectionKey={sectionKey} />
      </div>

      {showModal && (
        <DiagramRegenerateModal
          imageUrls={imageUrls}
          isRegenerating={isRegenerating}
          onClose={() => setShowModal(false)}
          onSubmit={handleRegenerateMulti}
        />
      )}
    </>
  );
}
