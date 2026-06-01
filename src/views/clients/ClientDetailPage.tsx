"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  Upload,
  Search,
  FileText,
  Edit,
  ExternalLink,
  X,
  Trash2,
  Download,
  FileDown,
  CheckCircle,
  Clock,
} from "lucide-react";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";

import styles from "./ClientDetailPage.module.scss";

import { useClientStore } from "@/store/features/clients/clientSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useProposalDownload } from "@/hooks/useProposalDownload";
import type { ClientDocument } from "@/services/client.service";
import { listProposals } from "@/services/proposal.service";
import { listDrafts } from "@/services/draft.service";
import * as clientApi from "@/services/client.service";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";
import type { DraftMetadata } from "@/interfaces/draftInterfaces";
import { formatDate } from "@/utils/dateUtils";
import PageLayout from "@/layouts/AppLayout";
import ClientDetailSkeleton from "@/components/common/skeletons/ClientDetailSkeleton";

const EditClientModal = dynamic(() => import("@/components/modals/EditClientModal"), {
  ssr: false,
});

const TemplateSelectionModal = dynamic(
  () => import("@/components/modals/TemplateSelectionModal/TemplateSelectionModal"),
  {
    ssr: false,
  }
);

const DeleteClientModal = dynamic(() => import("@/components/modals/DeleteClientModal"), {
  ssr: false,
});

const DeleteDocumentModal = dynamic(() => import("@/components/modals/DeleteDocumentModal"), {
  ssr: false,
});

const DeleteAllDocumentsModal = dynamic(
  () => import("@/components/modals/DeleteAllDocumentsModal"),
  {
    ssr: false,
  }
);

export default function ClientWorkspacePage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setCurrentDraftId = useDraftSessionStore((state) => state.setCurrentDraftId);

  const clientIdParam = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const clientId =
    typeof clientIdParam === "string" ? parseInt(clientIdParam, 10) : (clientIdParam as number);

  // Read directly from store to avoid useClient auto-fetch
  const client = useClientStore((state) => state.getClientById(clientId));
  const loading = useClientStore((state) => state.isLoading);
  const fetchClients = useClientStore((state) => state.fetchClients);
  const uploadDocumentToStore = useClientStore((state) => state.uploadDocument);
  const removeDocumentFromStore = useClientStore((state) => state.removeDocument);
  const deleteClientFromStore = useClientStore((state) => state.deleteClient);
  const { downloadProposal } = useProposalDownload();
  const hasFetchedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [proposalSearchQuery, setProposalSearchQuery] = useState<string>("");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [clientProposals, setClientProposals] = useState<ProposalListItem[]>([]);
  const [clientDrafts, setClientDrafts] = useState<DraftMetadata[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState<boolean>(true);
  const [downloadingProposalId, setDownloadingProposalId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [deleteClientModalOpen, setDeleteClientModalOpen] = useState<boolean>(false);
  const [deleteDocModalData, setDeleteDocModalData] = useState<{ id: number; name: string } | null>(
    null
  );
  const [deleteAllDocsModalOpen, setDeleteAllDocsModalOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // One-time fetch if client doesn't exist in store
  useEffect(() => {
    if (!client && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      console.log("[ClientDetailPage] Fetching clients - client not found in store");
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log when client documents change
  useEffect(() => {
    if (client) {
      console.log("[ClientDetailPage] Client documents updated:", {
        clientId: client.id,
        documentCount: client.documents.length,
        documentIds: client.documents.map((d) => ({ id: d.id, name: d.name })),
      });
    }
  }, [client]);

  function handleNewProposal(): void {
    setCurrentDraftId(null); // Clear draft ID for new proposal
    setShowTemplateModal(true);
  }

  async function handleDownloadProposal(proposalId: number): Promise<void> {
    setDownloadingProposalId(proposalId);
    try {
      await downloadProposal(proposalId);
    } finally {
      setDownloadingProposalId(null);
    }
  }

  // Auto-load proposals immediately when component mounts
  useEffect(() => {
    loadClientProposals();
  }, [clientId]);

  async function loadClientProposals(): Promise<void> {
    setIsLoadingProposals(true);
    try {
      const [proposals, drafts] = await Promise.all([listProposals(), listDrafts()]);
      const clientHistory = proposals.filter((p) => p.clientId === clientId);
      setClientProposals(clientHistory);
      // Drafts matched by clientId (proposalId link) or clientName fallback
      const proposalIds = new Set(clientHistory.map((p) => p.id));
      const clientName = client?.name ?? "";
      const clientDraftList = drafts.filter(
        (d) =>
          (d.proposalId != null && proposalIds.has(d.proposalId)) ||
          d.clientName.toLowerCase() === clientName.toLowerCase()
      );
      // Exclude drafts that already have a proposal entry (stage=generated → already in proposals list)
      const linkedProposalIds = new Set(clientHistory.map((p) => p.id));
      setClientDrafts(
        clientDraftList.filter((d) => d.proposalId == null || !linkedProposalIds.has(d.proposalId))
      );
    } catch (error) {
      logger.error("Failed to load client proposals:", error);
    } finally {
      setIsLoadingProposals(false);
    }
  }

  function handleDeleteDocument(docId: number, docName: string): void {
    console.log("[ClientDetailPage] handleDeleteDocument called:", { docId, docName });
    setDeleteDocModalData({ id: docId, name: docName });
  }

  async function handleViewDocument(doc: ClientDocument): Promise<void> {
    if (!client) return;
    if (!doc.s3FileUrl) {
      toast.error("This document has no stored file — it was uploaded before S3 was enabled.");
      return;
    }
    try {
      setViewingDocId(doc.id);
      const viewUrl = await clientApi.getDocumentViewUrl(client.id, doc.id);
      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open document. Please try again.");
    } finally {
      setViewingDocId(null);
    }
  }

  async function confirmDeleteDocument(): Promise<void> {
    if (!client || !deleteDocModalData) return;

    try {
      console.log(
        "[ClientDetailPage] Deleting document:",
        deleteDocModalData.id,
        deleteDocModalData.name
      );

      // Optimistic update: update store
      removeDocumentFromStore(client.id, deleteDocModalData.id);
      setDeleteDocModalData(null);

      // Call API in background
      await clientApi.deleteDocument(client.id, deleteDocModalData.id);
      console.log("[ClientDetailPage] Document deleted successfully from API");
    } catch (error) {
      console.error("[ClientDetailPage] Failed to delete document:", error);
      logger.error("Failed to delete document:", error);
      toast.error("Failed to delete document");
    }
  }

  function handleDeleteAllDocuments(): void {
    if (!client || client.documents.length === 0) return;
    setDeleteAllDocsModalOpen(true);
  }

  async function confirmDeleteAllDocuments(): Promise<void> {
    if (!client || client.documents.length === 0) return;

    try {
      // Optimistic update: remove all documents from store
      client.documents.forEach((doc) => {
        removeDocumentFromStore(client.id, doc.id);
      });
      setDeleteAllDocsModalOpen(false);

      // Call API in background
      await Promise.allSettled(
        client.documents.map((doc) => clientApi.deleteDocument(client.id, doc.id))
      );
    } catch (error) {
      logger.error("An unexpected error occurred during bulk document deletion:", error);
      toast.error("An unexpected error occurred");
    }
  }

  function handleDeleteClient(): void {
    setDeleteClientModalOpen(true);
  }

  async function confirmDeleteClient(): Promise<void> {
    if (!client) return;

    try {
      await deleteClientFromStore(client.id);
      toast.success("Client deleted");
      router.push("/clients");
    } catch (error) {
      logger.error("Failed to delete client:", error);
      toast.error("Failed to delete client");
    }
  }

  async function handleFileUpload(files: FileList | null): Promise<void> {
    if (!files || !client) return;

    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const fileId = `${file.name}-${Date.now()}`;
      try {
        setUploadingFiles((prev) => new Set(prev).add(fileId));

        const uploadedDoc = await uploadDocumentToStore(client.id, file);

        if (!uploadedDoc) {
          throw new Error("Failed to upload document: uploadedDoc is undefined");
        }
      } catch (error) {
        logger.error(`Failed to upload ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploadingFiles((prev) => {
          const next = new Set(prev);
          next.delete(fileId);
          return next;
        });
      }
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    handleFileUpload(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function getTemplateTypeLabel(proposal: ProposalListItem): string {
    // Use templateId to determine the actual template name
    if (proposal.templateId) {
      // Map template IDs to names
      const templateNames: Record<string, string> = {
        saas: "SaaS",
        consulting: "Consulting",
        agency: "Agency",
        ecommerce: "E-Commerce",
        enterprise: "Enterprise",
      };
      return templateNames[proposal.templateId] || proposal.templateId;
    }

    // Fallback to templateType
    switch (proposal.templateType) {
      case "predefined":
        return "Template";
      case "custom":
        return "Custom";
      case "scratch":
        return "From Scratch";
      case "recreate":
        return "Recreated";
      default:
        return proposal.templateType || "Template";
    }
  }

  if (!mounted || loading) {
    return (
      <PageLayout>
        <ClientDetailSkeleton />
      </PageLayout>
    );
  }

  if (!client) {
    return (
      <PageLayout>
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Client not found</div>
        </div>
      </PageLayout>
    );
  }

  const filteredDocuments = client.documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProposals = clientProposals.filter((proposal) => {
    if (!proposalSearchQuery) return true;
    const q = proposalSearchQuery.toLowerCase();
    return (
      proposal.title.toLowerCase().includes(q) ||
      proposal.clientName.toLowerCase().includes(q) ||
      String(proposal.id).includes(q) ||
      (proposal.version != null && String(proposal.version).includes(q))
    );
  });

  const filteredDraftRows = clientDrafts.filter((d) => {
    if (!proposalSearchQuery) return true;
    const q = proposalSearchQuery.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.clientName.toLowerCase().includes(q);
  });

  return (
    <PageLayout>
      <div className={styles.clientHeader}>
        <div className={styles.clientHeaderLeft}>
          <div className={styles.clientBadge}>
            <span className={styles.clientBadgeLabel}>Client Workspace</span>
            <span className={styles.clientBadgeStatus}>Active</span>
          </div>
          <h1 className={styles.clientName}>{client.name}</h1>
          <p className={styles.clientMeta}>
            {client.industry} Active Created {formatDate(client.createdAt)}
          </p>
        </div>
        <div className={styles.clientHeaderActions}>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
            <Edit size={18} />
            Edit Details
          </button>
          <button className="btn btn-primary" onClick={handleNewProposal}>
            New Proposal
          </button>
          <button
            className={styles.deleteClientBtn}
            onClick={handleDeleteClient}
            title="Delete client"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className={styles.splitLayout}>
        {/* Knowledge Base Section */}
        <div className={styles.knowledgeBase}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Knowledge Base</h2>
              <p className={styles.panelSubtitle}>Source documents for context generation</p>
            </div>
            <div className={styles.headerActions}>
              {filteredDocuments.length > 0 && (
                <button
                  className={styles.deleteAllBtn}
                  onClick={handleDeleteAllDocuments}
                  title="Delete all documents"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles.size > 0}
                title="Upload Document"
              >
                <Upload size={20} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
              multiple
              onChange={handleFileInputChange}
              style={{ display: "none" }}
            />
          </div>

          {uploadingFiles.size > 0 && (
            <div className={styles.uploadingIndicator}>
              <div className={styles.uploadingText}>Uploading and parsing documents...</div>
            </div>
          )}

          {filteredDocuments.length === 0 && uploadingFiles.size === 0 ? (
            <div className={styles.emptyState}>
              <FileText size={48} />
              <p>No documents yet</p>
              <p>Upload documents to build context</p>
            </div>
          ) : (
            <div className={styles.documentList}>
              {filteredDocuments.map((doc) => {
                const iconClass =
                  doc.fileType === "pdf"
                    ? styles.iconPdf
                    : doc.fileType === "docx"
                      ? styles.iconDocx
                      : doc.fileType === "xlsx"
                        ? styles.iconXlsx
                        : styles.iconDefault;

                return (
                  <div
                    key={doc.id}
                    className={styles.documentItem}
                    onClick={() => handleViewDocument(doc)}
                    style={{ cursor: doc.s3FileUrl ? "pointer" : "default" }}
                    title={doc.s3FileUrl ? "Click to view file" : undefined}
                  >
                    <div className={`${styles.documentIcon} ${iconClass}`}>
                      {viewingDocId === doc.id ? (
                        <ExternalLink size={20} style={{ opacity: 0.5 }} />
                      ) : (
                        <FileText size={20} />
                      )}
                    </div>
                    <div className={styles.documentInfo}>
                      <div className={styles.documentName}>{doc.name}</div>
                      <div className={styles.documentMeta}>
                        <span>{Math.round(doc.sizeBytes / 1024)} KB</span>
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                    </div>
                    <div className={styles.documentStatus}>
                      {doc.status === "parsed" ? (
                        <span className={styles.statusParsed}>
                          <span className={styles.statusDot}></span>
                          PARSED
                        </span>
                      ) : (
                        <span className={styles.statusProcessing}>
                          <span className={styles.statusDotProcessing}></span>
                          PROCESSING
                        </span>
                      )}
                    </div>
                    <button
                      className={styles.deleteDocBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.id, doc.name);
                      }}
                      title="Delete document"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Proposal History Section */}
        <div className={styles.proposalHistory}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Proposal History</h2>
              <p className={styles.panelSubtitle}>Recent outputs and generated drafts</p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.searchInput}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search proposals..."
                  value={proposalSearchQuery}
                  onChange={(e) => setProposalSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {isLoadingProposals ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>Loading proposals...</div>
            </div>
          ) : filteredProposals.length === 0 && filteredDraftRows.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText size={48} />
              <p>No proposals yet</p>
              <p>Create a proposal to get started</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.proposalTable}>
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className={styles.actionsCol}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals.map((proposal) => (
                    <tr
                      key={`proposal-${proposal.id}`}
                      className={styles.proposalRow}
                      onClick={() => router.push(`/proposal/${proposal.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className={styles.proposalName}>{proposal.title}</div>
                        {proposal.version != null && (
                          <div className={styles.proposalVersion}>v{proposal.version}</div>
                        )}
                      </td>
                      <td>
                        <span className={styles.typeBadge}>{getTemplateTypeLabel(proposal)}</span>
                      </td>
                      <td className={styles.dateCell}>{formatDate(proposal.createdAt)}</td>
                      <td>
                        <div className={styles.statusCell}>
                          {proposal.approvalStatus === "approved" && (
                            <>
                              <CheckCircle size={16} className={styles.statusIconFinalized} />
                              <span>Approved</span>
                            </>
                          )}
                          {proposal.approvalStatus === "rejected" && (
                            <>
                              <X size={16} className={styles.statusIconReview} />
                              <span className={styles.statusReview}>Rejected</span>
                            </>
                          )}
                          {proposal.approvalStatus === "pending" && (
                            <>
                              <Clock size={16} className={styles.statusIconDraft} />
                              <span>Draft</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className={styles.actionsCol}>
                        <div className={styles.actionsCol}>
                          <button
                            className={styles.actionBtn}
                            style={{ minWidth: "80px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDownloadProposal(proposal.id);
                            }}
                            disabled={downloadingProposalId === proposal.id}
                            title="Download as Word Document"
                          >
                            {downloadingProposalId === proposal.id ? (
                              <div className="flex items-center gap-2 justify-center">
                                <span
                                  className="spinner spinner-white"
                                  style={{ width: 14, height: 14 }}
                                />
                                <span className={styles.actionLabel}>Downloading...</span>
                              </div>
                            ) : (
                              <>
                                <FileDown size={16} />
                                <span className={styles.actionLabel}>DOCX</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredDraftRows.map((draft) => (
                    <tr
                      key={`draft-${draft.id}`}
                      className={styles.proposalRow}
                      onClick={() => router.push("/drafts")}
                      style={{ cursor: "pointer" }}
                      title="View in Drafts"
                    >
                      <td>
                        <div className={styles.proposalName}>{draft.title || "Untitled Draft"}</div>
                        <div
                          className={styles.proposalVersion}
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          In Progress
                        </div>
                      </td>
                      <td>
                        <span className={styles.typeBadge}>
                          {draft.templateType === "scratch" || !draft.templateType
                            ? "From Scratch"
                            : draft.templateType}
                        </span>
                      </td>
                      <td className={styles.dateCell}>{formatDate(draft.updatedAt)}</td>
                      <td>
                        <div className={styles.statusCell}>
                          <Edit size={16} className={styles.statusIconDraft} />
                          <span>Draft</span>
                        </div>
                      </td>
                      <td className={styles.actionsCol}>
                        <div className={styles.actionsCol}>
                          <button
                            className={styles.actionBtn}
                            style={{ minWidth: "80px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push("/drafts");
                            }}
                            title="Resume editing this draft"
                          >
                            <Edit size={16} />
                            <span className={styles.actionLabel}>Resume</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <EditClientModal
          client={client}
          onClose={() => setShowEditModal(false)}
          onClientUpdated={() => {
            setShowEditModal(false);
          }}
        />
      )}

      {showTemplateModal && client && (
        <TemplateSelectionModal
          templateId={null}
          templateName=""
          onClose={() => setShowTemplateModal(false)}
          onNewClient={() => {}}
          initialClients={[client]}
          newClientData={{
            client: { id: client.id, name: client.name },
            notes: client.notes || "",
            uploadedFiles: [],
          }}
          enableTemplateSelection={true}
        />
      )}

      {deleteClientModalOpen && client && (
        <DeleteClientModal
          clientName={client.name}
          onClose={() => setDeleteClientModalOpen(false)}
          onConfirm={confirmDeleteClient}
        />
      )}

      {deleteDocModalData && (
        <DeleteDocumentModal
          key={`delete-doc-${deleteDocModalData.id}`}
          documentName={deleteDocModalData.name}
          onClose={() => setDeleteDocModalData(null)}
          onConfirm={confirmDeleteDocument}
        />
      )}

      {deleteAllDocsModalOpen && client && (
        <DeleteAllDocumentsModal
          documentCount={client.documents.length}
          onClose={() => setDeleteAllDocsModalOpen(false)}
          onConfirm={confirmDeleteAllDocuments}
        />
      )}
    </PageLayout>
  );
}
