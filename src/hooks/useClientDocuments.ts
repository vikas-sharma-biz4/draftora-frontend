"use client";

import { useState, useRef, useCallback } from "react";
import { useClientStore } from "@/store/features/clients/clientSlice";
import * as clientApi from "@/services/client.service";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import type { ClientDocument, ClientWithDocuments } from "@/interfaces/clientInterfaces";

interface UseClientDocumentsReturn {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  uploadingFiles: Set<string>;
  viewingDocId: number | null;
  viewingDocModal: { url: string; fileName: string; fileType: string } | null;
  closeDocViewer: () => void;
  deleteDocModalData: { id: number; name: string } | null;
  setDeleteDocModalData: (data: { id: number; name: string } | null) => void;
  deleteAllDocsModalOpen: boolean;
  setDeleteAllDocsModalOpen: (open: boolean) => void;
  filteredDocuments: ClientDocument[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleViewDocument: (doc: ClientDocument) => Promise<void>;
  handleDeleteDocument: (docId: number, docName: string) => void;
  confirmDeleteDocument: () => Promise<void>;
  handleDeleteAllDocuments: () => void;
  confirmDeleteAllDocuments: () => Promise<void>;
}

export function useClientDocuments(
  client: ClientWithDocuments | undefined
): UseClientDocumentsReturn {
  const uploadDocumentToStore = useClientStore((state) => state.uploadDocument);
  const removeDocumentFromStore = useClientStore((state) => state.removeDocument);
  const deleteDocumentFromStore = useClientStore((state) => state.deleteDocument);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);
  const [viewingDocModal, setViewingDocModal] = useState<{
    url: string;
    fileName: string;
    fileType: string;
  } | null>(null);
  const [deleteDocModalData, setDeleteDocModalData] = useState<{ id: number; name: string } | null>(
    null
  );
  const [deleteAllDocsModalOpen, setDeleteAllDocsModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewInFlightRef = useRef<boolean>(false);

  const filteredDocuments = (client?.documents ?? []).filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = useCallback(
    async (files: FileList | null): Promise<void> => {
      if (!files || !client) return;

      for (const file of Array.from(files)) {
        const fileId = `${file.name}-${Date.now()}`;
        setUploadingFiles((prev) => new Set(prev).add(fileId));
        try {
          const uploaded = await uploadDocumentToStore(client.id, file);
          if (!uploaded) throw new Error("Upload returned undefined");
        } catch (error) {
          logger.error(`[useClientDocuments] Failed to upload ${file.name}:`, error);
          toast.error(`Failed to upload ${file.name}`);
        } finally {
          setUploadingFiles((prev) => {
            const next = new Set(prev);
            next.delete(fileId);
            return next;
          });
        }
      }
    },
    [client, uploadDocumentToStore]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      void handleFileUpload(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFileUpload]
  );

  const closeDocViewer = useCallback((): void => {
    setViewingDocModal(null);
  }, []);

  const handleViewDocument = useCallback(
    async (doc: ClientDocument): Promise<void> => {
      if (!client || viewInFlightRef.current) return;
      viewInFlightRef.current = true;
      try {
        setViewingDocId(doc.id);
        const viewUrl = await clientApi.getDocumentViewUrl(client.id, doc.id);
        if (!viewUrl.startsWith("https://")) {
          throw new Error("Invalid document URL");
        }
        setViewingDocId(null);
        setViewingDocModal({ url: viewUrl, fileName: doc.name, fileType: doc.fileType });
      } catch (error) {
        const httpError = error as { statusCode?: number };
        if (httpError?.statusCode === 400) {
          toast.error("This document has no stored file — it was uploaded before S3 was enabled.");
        } else if (httpError?.statusCode === 404) {
          toast.error("Document not found.");
        } else {
          toast.error("Could not open document. Please try again.");
        }
      } finally {
        viewInFlightRef.current = false;
        setViewingDocId(null);
      }
    },
    [client]
  );

  const handleDeleteDocument = useCallback((docId: number, docName: string): void => {
    setDeleteDocModalData({ id: docId, name: docName });
  }, []);

  const confirmDeleteDocument = useCallback(async (): Promise<void> => {
    if (!client || !deleteDocModalData) return;

    const { id: docId } = deleteDocModalData;
    setDeleteDocModalData(null);

    try {
      // Store action does optimistic remove + snapshot rollback on API failure
      await deleteDocumentFromStore(client.id, docId);
    } catch (error) {
      logger.error("[useClientDocuments] Failed to delete document", { docId, error });
      toast.error("Failed to delete document. The file has been restored.");
    }
  }, [client, deleteDocModalData, deleteDocumentFromStore]);

  const handleDeleteAllDocuments = useCallback((): void => {
    if (!client || client.documents.length === 0) return;
    setDeleteAllDocsModalOpen(true);
  }, [client]);

  const confirmDeleteAllDocuments = useCallback(async (): Promise<void> => {
    if (!client || client.documents.length === 0) return;

    const docsToDelete = [...client.documents];
    docsToDelete.forEach((doc) => removeDocumentFromStore(client.id, doc.id));
    setDeleteAllDocsModalOpen(false);

    const results = await Promise.allSettled(
      docsToDelete.map((doc) => clientApi.deleteDocument(client.id, doc.id))
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      logger.error("[useClientDocuments] Bulk delete partial failure", {
        failures: failures.length,
      });
      toast.error(
        `${failures.length} document${failures.length > 1 ? "s" : ""} could not be deleted`
      );
    }
  }, [client, removeDocumentFromStore]);

  return {
    searchQuery,
    setSearchQuery,
    uploadingFiles,
    viewingDocId,
    viewingDocModal,
    closeDocViewer,
    deleteDocModalData,
    setDeleteDocModalData,
    deleteAllDocsModalOpen,
    setDeleteAllDocsModalOpen,
    filteredDocuments,
    fileInputRef,
    handleFileInputChange,
    handleViewDocument,
    handleDeleteDocument,
    confirmDeleteDocument,
    handleDeleteAllDocuments,
    confirmDeleteAllDocuments,
  };
}
