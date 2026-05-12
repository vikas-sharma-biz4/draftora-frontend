"use client";

import DeleteConfirmModal from "../DeleteConfirmModal";

interface DeleteAllDocumentsModalProps {
  documentCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAllDocumentsModal({ documentCount, onClose, onConfirm }: DeleteAllDocumentsModalProps): JSX.Element | null {
  return (
    <DeleteConfirmModal
      title="Delete All Documents"
      itemName={`all ${documentCount} document${documentCount !== 1 ? 's' : ''}`}
      warningMessage="This action cannot be undone. All documents will be permanently removed from the knowledge base."
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
