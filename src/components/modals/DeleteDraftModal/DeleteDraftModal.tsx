"use client";

import DeleteConfirmModal from "../DeleteConfirmModal";

interface DeleteDraftModalProps {
  draftName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteDraftModal({ draftName, onClose, onConfirm }: DeleteDraftModalProps): JSX.Element | null {
  return (
    <DeleteConfirmModal
      title="Delete Draft"
      itemName={draftName}
      warningMessage="This action cannot be undone. The draft and all its progress will be permanently removed."
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
