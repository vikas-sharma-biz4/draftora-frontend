"use client";

import DeleteConfirmModal from "../DeleteConfirmModal";

interface DeleteClientModalProps {
  clientName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteClientModal({ clientName, onClose, onConfirm }: DeleteClientModalProps): JSX.Element | null {
  return (
    <DeleteConfirmModal
      title="Delete Client"
      itemName={clientName}
      warningMessage="This action cannot be undone. All associated proposals and documents will be permanently removed."
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
