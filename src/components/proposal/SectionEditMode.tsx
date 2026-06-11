"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { isHtmlContent, plainTextToHtml } from "@/utils/contentParser";
import { type RegenerateSelectionResult } from "@/services/proposal/proposalSections.service";

const RichEditor = dynamic(() => import("@/components/common/RichEditor"), {
  ssr: false,
  loading: () => <div className="rte-content text-light">Loading editor…</div>,
});

interface RegenerateSelectionParams {
  selectedText: string;
  selectionRange: { from: number; to: number };
  instructions?: string;
  selectionContext?: string;
}

interface SectionEditModeProps {
  sectionKey: string;
  content: string;
  onContentChange: (key: string, html: string) => void;
  onSave: (key: string, content: string) => Promise<void>;
  onRegenerateSelection?: (
    params: RegenerateSelectionParams
  ) => Promise<RegenerateSelectionResult | null>;
  placeholder?: string;
}

/**
 * Always-editable component for proposal section content.
 *
 * FEATURES:
 * - Always rendered (no view/edit mode switching)
 * - Auto-saves with debouncing
 * - Handles content conversion (markdown → HTML)
 * - Click anywhere to edit, cursor appears on click
 */
const SectionEditMode = memo(function SectionEditMode({
  sectionKey,
  content,
  onContentChange,
  onSave,
  onRegenerateSelection,
  placeholder = "Start writing…",
}: SectionEditModeProps): JSX.Element {
  const [localContent, setLocalContent] = useState<string>(content);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const debouncedAutoSave = useCallback(
    (contentToSave: string) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(async () => {
        await onSave(sectionKey, contentToSave);
      }, 300);
    },
    [sectionKey, onSave]
  );

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handleEditorChange = useCallback(
    (html: string): void => {
      setLocalContent(html);
      onContentChange(sectionKey, html);
      debouncedAutoSave(html);
    },
    [sectionKey, onContentChange, debouncedAutoSave]
  );

  const editorContent = useMemo(() => {
    // Markdown tables that contain inline HTML (<br> in cells) must still go through
    // plainTextToHtml — not be returned as-is. A content string starting with "|" is
    // a markdown table regardless of whether it contains HTML tags like <br>.
    if (isHtmlContent(localContent) && !localContent.trimStart().startsWith("|")) {
      return localContent;
    }
    return plainTextToHtml(localContent);
  }, [localContent]);

  return (
    <div className="section-edit-mode">
      <RichEditor
        content={editorContent}
        onChange={handleEditorChange}
        placeholder={placeholder}
        onRegenerateSelection={onRegenerateSelection}
      />
    </div>
  );
});

export default SectionEditMode;
