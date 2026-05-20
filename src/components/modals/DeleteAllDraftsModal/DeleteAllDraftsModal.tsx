"use client";

import DeleteConfirmModal from "../DeleteConfirmModal";

interface DeleteAllDraftsModalProps {
  draftCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAllDraftsModal({ draftCount, onClose, onConfirm }: DeleteAllDraftsModalProps): JSX.Element | null {
  return (
    <DeleteConfirmModal
      title="Delete All Drafts"
      itemName={`${draftCount} draft${draftCount !== 1 ? "s" : ""}`}
      warningMessage="This action cannot be undone. All drafts and their progress will be permanently removed."
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
