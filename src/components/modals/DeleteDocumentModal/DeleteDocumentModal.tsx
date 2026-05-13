"use client";

import DeleteConfirmModal from "../DeleteConfirmModal";

interface DeleteDocumentModalProps {
  documentName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteDocumentModal({ documentName, onClose, onConfirm }: DeleteDocumentModalProps): JSX.Element | null {
  return (
    <DeleteConfirmModal
      title="Delete Document"
      itemName={documentName}
      warningMessage="This action cannot be undone. The document will be permanently removed from the knowledge base."
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
