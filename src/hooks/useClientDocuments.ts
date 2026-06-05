"use client";

import { useState, useRef, useCallback } from "react";
import { useClientStore } from "@/store/features/clients/clientSlice";
import * as clientApi from "@/services/client.service";
import { migrateDocumentsToS3, restoreDocumentToS3 } from "@/services/client.service";
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
  restoringDocId: number | null;
  isMigratingToS3: boolean;
  deleteDocModalData: { id: number; name: string } | null;
  setDeleteDocModalData: (data: { id: number; name: string } | null) => void;
  deleteAllDocsModalOpen: boolean;
  setDeleteAllDocsModalOpen: (open: boolean) => void;
  filteredDocuments: ClientDocument[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  restoreFileInputRef: React.RefObject<HTMLInputElement>;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRestoreFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleViewDocument: (doc: ClientDocument) => Promise<void>;
  handleDeleteDocument: (docId: number, docName: string) => void;
  confirmDeleteDocument: () => Promise<void>;
  handleDeleteAllDocuments: () => void;
  confirmDeleteAllDocuments: () => Promise<void>;
  handleRestoreToS3Click: (docId: number, e: React.MouseEvent) => void;
  handleMigrateAllToS3: () => Promise<void>;
}

export function useClientDocuments(
  client: ClientWithDocuments | undefined
): UseClientDocumentsReturn {
  const uploadDocumentToStore = useClientStore((state) => state.uploadDocument);
  const removeDocumentFromStore = useClientStore((state) => state.removeDocument);
  const deleteDocumentFromStore = useClientStore((state) => state.deleteDocument);
  const updateDocumentInStore = useClientStore((state) => state.updateDocument);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);
  const [viewingDocModal, setViewingDocModal] = useState<{
    url: string;
    fileName: string;
    fileType: string;
  } | null>(null);
  const [restoringDocId, setRestoringDocId] = useState<number | null>(null);
  const [isMigratingToS3, setIsMigratingToS3] = useState<boolean>(false);
  const [deleteDocModalData, setDeleteDocModalData] = useState<{ id: number; name: string } | null>(
    null
  );
  const [deleteAllDocsModalOpen, setDeleteAllDocsModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
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

  const handleRestoreToS3Click = useCallback((docId: number, e: React.MouseEvent): void => {
    e.stopPropagation();
    setRestoringDocId(docId);
    restoreFileInputRef.current?.click();
  }, []);

  const handleRestoreFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = e.target.files?.[0];
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = "";
      if (!file || !client || restoringDocId === null) return;

      const docId = restoringDocId;
      setRestoringDocId(null);
      try {
        const { s3FileUrl } = await restoreDocumentToS3(client.id, docId, file);
        updateDocumentInStore(client.id, docId, { s3FileUrl });
        toast.success("Document uploaded to S3 — you can now view it.");
      } catch (error) {
        logger.error("[useClientDocuments] Failed to restore document to S3", {
          documentId: docId,
          error,
        });
        toast.error("Failed to upload to S3. Check your S3 configuration.");
      }
    },
    [client, restoringDocId, updateDocumentInStore]
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

  const handleMigrateAllToS3 = useCallback(async (): Promise<void> => {
    if (!client || isMigratingToS3) return;

    const pending = client.documents.filter((d) => !d.s3FileUrl);
    if (pending.length === 0) {
      toast.success("All documents already have S3 URLs.");
      return;
    }

    setIsMigratingToS3(true);
    try {
      const result = await migrateDocumentsToS3(client.id);
      result.results.forEach((item) => {
        if (item.s3FileUrl)
          updateDocumentInStore(client.id, item.id, { s3FileUrl: item.s3FileUrl });
      });
      if (result.failed > 0) {
        toast.error(
          `Migration finished: ${result.migrated} done, ${result.failed} failed, ${result.skipped} skipped.`
        );
      } else {
        toast.success(
          `${result.migrated} document${result.migrated !== 1 ? "s" : ""} migrated to S3 successfully.`
        );
      }
    } catch (error) {
      logger.error("[useClientDocuments] Bulk S3 migration failed", { error });
      toast.error("Migration failed. Check your S3 configuration and try again.");
    } finally {
      setIsMigratingToS3(false);
    }
  }, [client, isMigratingToS3, updateDocumentInStore]);

  return {
    searchQuery,
    setSearchQuery,
    uploadingFiles,
    viewingDocId,
    viewingDocModal,
    closeDocViewer,
    restoringDocId,
    isMigratingToS3,
    deleteDocModalData,
    setDeleteDocModalData,
    deleteAllDocsModalOpen,
    setDeleteAllDocsModalOpen,
    filteredDocuments,
    fileInputRef,
    restoreFileInputRef,
    handleFileInputChange,
    handleRestoreFileInputChange,
    handleViewDocument,
    handleDeleteDocument,
    confirmDeleteDocument,
    handleDeleteAllDocuments,
    confirmDeleteAllDocuments,
    handleRestoreToS3Click,
    handleMigrateAllToS3,
  };
}
