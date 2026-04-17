"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { isHtmlContent, plainTextToHtml } from "@/utils/contentParser";

const RichEditor = dynamic(() => import("@/components/common/RichEditor"), {
  ssr: false,
  loading: () => (
    <div className="rte-content text-light">
      Loading editor…
    </div>
  ),
});

interface SectionEditModeProps {
  sectionKey: string;
  content: string;
  onContentChange: (key: string, html: string) => void;
  onSave: (key: string, content: string) => Promise<void>;
  onRegenerateSelection?: (selectedText: string) => void;
  placeholder?: string;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Pure edit-only component for editing proposal section content.
 * 
 * CRITICAL RULES:
 * - Only renders when explicitly in edit mode
 * - NO view mode rendering
 * - Auto-saves with debouncing
 * - Handles content conversion (markdown → HTML)
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
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
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
        setIsSaving(true);
        await onSave(sectionKey, contentToSave);
        setLastSaved(new Date());
        setIsSaving(false);
      }, 1500);
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
    if (isHtmlContent(localContent)) {
      return localContent;
    }
    return plainTextToHtml(localContent);
  }, [localContent]);

  return (
    <div className="section-edit-mode">
      <div className="auto-save-indicator">
        {isSaving ? (
          <>
            <span className="spinner spinner-sm" />
            <span>Saving...</span>
          </>
        ) : lastSaved ? (
          <span className="text-muted">Saved {formatTimeAgo(lastSaved)}</span>
        ) : null}
      </div>

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
