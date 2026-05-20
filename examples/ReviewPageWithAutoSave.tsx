"use client";

import React from "react";
// import { useProposal } from "@/context/ProposalContext";
// import { useAutoSave } from "@/hooks/useAutoSave";
// import { useRouteGuard } from "@/hooks/useRouteGuard";
// import { SaveDraftButton, AutoSaveIndicator } from "@/components/draft";
import { toast } from "sonner";

export function ReviewPageWithAutoSave(): JSX.Element {
  // TODO: These dependencies need to be created or imports should be updated
  // const { proposalData, autoSaveEnabled, setCurrentDraftId } = useProposal();
  const proposalData = { title: "" };
  const autoSaveEnabled = false;
  const setCurrentDraftId = (id: number) => {};

  // const { saveNow, isSaving, lastSaved } = useAutoSave({
  //   enabled: autoSaveEnabled,
  //   debounceMs: 2000,
  //   location: "WIZARD_REVIEW",
  //   onSaveSuccess: (draftId) => {
  //     setCurrentDraftId(draftId);
  //   },
  //   onSaveError: (error) => {
  //     toast.error(`Auto-save failed: ${error.message}`);
  //   },
  // });

  const saveNow = async () => {};
  const isSaving = false;
  const lastSaved: Date | null = null;

  // useRouteGuard({
  //   enabled: autoSaveEnabled,
  //   onRouteChange: async () => {
  //     await saveNow();
  //   },
  // });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Review Proposal</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} /> */}
          {/* <SaveDraftButton
            onSave={saveNow}
            isSaving={isSaving}
            lastSaved={lastSaved}
            variant="primary"
          /> */}
        </div>
      </div>
    </div>
  );
}
