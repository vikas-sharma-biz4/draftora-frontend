"use client";

import React, { useEffect, useRef } from "react";
import { useProposal } from "@/context/ProposalContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useRouteGuard } from "@/hooks/useRouteGuard";
import { AutoSaveIndicator } from "@/components/draft";
import { toast } from "sonner";

export function WebViewPageWithAutoSave(): JSX.Element {
  const { proposalData, autoSaveEnabled, setCurrentDraftId } = useProposal();
  const scrollPositionRef = useRef<number>(0);

  const { saveNow, isSaving, lastSaved } = useAutoSave({
    enabled: autoSaveEnabled,
    debounceMs: 3000,
    location: "WEB_VIEW",
    onSaveSuccess: (draftId) => {
      setCurrentDraftId(draftId);
    },
    onSaveError: (error) => {
      console.error("Auto-save error:", error);
    },
  });

  useRouteGuard({
    enabled: autoSaveEnabled,
    onRouteChange: async () => {
      scrollPositionRef.current = window.scrollY;
      await saveNow();
    },
  });

  useEffect(() => {
    const handleScroll = (): void => {
      scrollPositionRef.current = window.scrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div>
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 1000 }}>
        <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} />
      </div>

      <div>
        <h1>{proposalData.title}</h1>
        <p>Client: {proposalData.clientName}</p>
      </div>
    </div>
  );
}
