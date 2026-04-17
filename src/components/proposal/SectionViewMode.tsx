"use client";

import { memo } from "react";
import ContentRenderer from "./ContentRenderer";

interface SectionViewModeProps {
  sectionKey: string;
  content: string;
  mermaidCode?: string;
}

/**
 * Pure view-only component for displaying proposal section content.
 * 
 * CRITICAL RULES:
 * - NO state changes
 * - NO onClick handlers that trigger re-renders
 * - NO conditional rendering
 * - ALWAYS renders the same component tree
 * 
 * This component is wrapped with React.memo to prevent re-renders
 * when parent state changes (e.g., activeSection, other sections updating).
 */
const SectionViewMode = memo(function SectionViewMode({
  sectionKey,
  content,
  mermaidCode,
}: SectionViewModeProps): JSX.Element {
  return (
    <div className="section-view-mode">
      <ContentRenderer
        sectionKey={sectionKey}
        content={content}
        mermaidCode={mermaidCode}
      />
    </div>
  );
});

export default SectionViewMode;
