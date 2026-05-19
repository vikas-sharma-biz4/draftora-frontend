"use client";

import React, { useEffect } from "react";
import { useProposal } from "@/context/ProposalContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useRouteGuard } from "@/hooks/useRouteGuard";
import { SaveDraftButton, AutoSaveIndicator } from "@/components/draft";
import { toast } from "sonner";

export function ParametersPageWithAutoSave(): JSX.Element {
  const { proposalData, autoSaveEnabled, setCurrentDraftId } = useProposal();

  const { saveNow, isSaving, lastSaved } = useAutoSave({
    enabled: autoSaveEnabled && proposalData.title.length > 0,
    debounceMs: 2000,
    location: "WIZARD_PARAMETERS",
    onSaveSuccess: (draftId) => {
      setCurrentDraftId(draftId);
      toast.success("Draft saved");
    },
    onSaveError: (error) => {
      toast.error(`Failed to save draft: ${error.message}`);
    },
  });

  useRouteGuard({
    enabled: autoSaveEnabled && proposalData.title.length > 0,
    onRouteChange: async () => {
      await saveNow();
    },
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveNow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveNow]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Proposal Parameters</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} />
          <SaveDraftButton
            onSave={saveNow}
            isSaving={isSaving}
            lastSaved={lastSaved}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
