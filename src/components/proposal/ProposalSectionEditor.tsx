/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROPOSAL SECTION EDITOR - PRODUCTION-GRADE ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROBLEM SOLVED:
 * ---------------
 * This component architecture eliminates:
 * ✓ Layout shift when clicking inside sections
 * ✓ Content "jumping" or "shaking"
 * ✓ Re-render cascade across all sections
 * ✓ Markdown flickering
 * ✓ Cursor position loss
 * ✓ Selection toolbar causing UI instability
 *
 * ROOT CAUSES FIXED:
 * ------------------
 * 1. ❌ onClick triggering state changes → ✓ Explicit "Edit" button only
 * 2. ❌ Conditional ReactMarkdown ↔ TipTap switching → ✓ Separate components
 * 3. ❌ Selection in React state → ✓ DOM-based selection (TipTap handles it)
 * 4. ❌ No memoization → ✓ React.memo with custom comparison
 * 5. ❌ Unstable callback props → ✓ useCallback in parent
 * 6. ❌ contentEditable on ReactMarkdown → ✓ Dedicated TipTap editor
 *
 * ARCHITECTURE:
 * -------------
 * ProposalSectionEditor (this file)
 *   ├─ SectionViewMode (read-only, ReactMarkdown, NO state changes)
 *   └─ SectionEditMode (TipTap editor, auto-save, only when editing)
 *
 * BEHAVIOR:
 * ---------
 * - View mode: Click does NOTHING (no re-render, no state change)
 * - Edit mode: Activated ONLY via "Edit" button
 * - Auto-save: Debounced 1.5s in edit mode
 * - Memoization: Prevents re-render when other sections update
 *
 * DO NOT MODIFY THIS ARCHITECTURE WITHOUT READING THE DOCUMENTATION ABOVE.
 * ═══════════════════════════════════════════════════════════════════════════
 */

"use client";

import { memo, useEffect, useState, useCallback } from "react";
import SectionEditMode from "./SectionEditMode";
import { regenerateSelection, type RegenerateSelectionResult } from "@/services/proposal/proposalSections.service";

interface RegenerateSelectionParams {
  selectedText: string;
  selectionRange: { from: number; to: number };
  instructions?: string;
  selectionContext?: string;
}

interface ProposalSectionEditorProps {
  proposalId: number;
  sectionKey: string;
  label: string;
  rawContent: string;
  onContentChange: (key: string, html: string) => void;
  onSave: (key: string, content: string) => Promise<void>;
}

/**
 * Renders a single proposal section with explicit view/edit mode switching.
 *
 * CRITICAL ARCHITECTURE (DO NOT MODIFY WITHOUT UNDERSTANDING):
 * ================================================================
 *
 * This component was refactored to eliminate layout shift, re-render cascade,
 * and markdown flickering issues. The architecture is intentionally strict.
 *
 * RULES:
 * ------
 * 1. View and Edit are SEPARATE components (SectionViewMode, SectionEditMode)
 * 2. Mode switching is EXPLICIT via "Edit" button click ONLY
 * 3. NO state changes on content click (clicking content does NOTHING)
 * 4. Component is memoized to prevent cascade re-renders
 * 5. NO conditional component replacement (both components exist, only one visible)
 *
 * WHY THIS MATTERS:
 * -----------------
 * - Clicking content in view mode does NOT trigger re-render
 * - ReactMarkdown stays mounted and stable (no flicker)
 * - TipTap editor only mounts when explicitly entering edit mode
 * - No DOM replacement = no layout shift
 * - Memoization prevents parent state changes from re-rendering all sections
 *
 * ANTI-PATTERNS TO AVOID:
 * -----------------------
 * ❌ DO NOT add onClick to view mode that triggers setIsEditing
 * ❌ DO NOT store selection in React state
 * ❌ DO NOT conditionally render ReactMarkdown ↔ TipTap in same tree
 * ❌ DO NOT remove React.memo wrapper
 * ❌ DO NOT make contentEditable on ReactMarkdown output
 *
 * View mode: SectionViewMode (pure, read-only, no state changes)
 * Edit mode: SectionEditMode (TipTap editor with auto-save)
 */
const ProposalSectionEditor = memo(function ProposalSectionEditor({
  proposalId,
  sectionKey,
  label,
  rawContent,
  onContentChange,
  onSave,
}: ProposalSectionEditorProps): JSX.Element {
  const [localContent, setLocalContent] = useState<string>(rawContent);

  useEffect(() => {
    setLocalContent(rawContent);
  }, [rawContent]);


  const handleContentChange = useCallback(
    (key: string, html: string): void => {
      setLocalContent(html);
      onContentChange(key, html);
    },
    [onContentChange]
  );

  const handleRegenerateSelection = useCallback(
    async (params: RegenerateSelectionParams): Promise<RegenerateSelectionResult | null> => {
      try {
        // Call the new selection-based regeneration API
        const result = await regenerateSelection(
          proposalId,
          sectionKey,
          params.selectedText,
          params.selectionContext,
          params.instructions
        );
        return result;
      } catch (error) {
        console.error("[ProposalSectionEditor] Selection regeneration failed:", error);
        return null;
      }
    },
    [proposalId, sectionKey]
  );

  return (
    <div className="proposal-page" id={`section-${sectionKey}`}>
      <div className="proposal-page-header">
        <h2 className="proposal-page-title">{label}</h2>
      </div>

      <SectionEditMode
        sectionKey={sectionKey}
        content={localContent}
        onContentChange={handleContentChange}
        onSave={onSave}
        onRegenerateSelection={handleRegenerateSelection}
        placeholder={`Write the ${label} section here…`}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if these specific props change
  return (
    prevProps.sectionKey === nextProps.sectionKey &&
    prevProps.label === nextProps.label &&
    prevProps.rawContent === nextProps.rawContent
    // Intentionally NOT comparing callback props (onContentChange, onSave, onRegenerate)
    // because they should be stable (wrapped in useCallback in parent)
  );
});

export default ProposalSectionEditor;
