"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Upload, Search, FileText, Edit, CheckCircle, Clock, X, Trash2, Download, FileDown } from "lucide-react";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";

import styles from "./ClientDetailPage.module.scss";

import { useClient } from "@/hooks/useClients";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import type { ClientDocument } from "@/services/client.service";
import { listProposals } from "@/services/proposal.service";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";
import { formatDate } from "@/utils/dateUtils";
import PageLayout from "@/layouts/AppLayout";
import ClientDetailSkeleton from "@/components/common/skeletons/ClientDetailSkeleton";

const EditClientModal = dynamic(() => import("@/components/modals/EditClientModal"), {
  ssr: false,
});

const TemplateSelectionModal = dynamic(() => import("@/components/modals/TemplateSelectionModal"), {
  ssr: false,
});

const DeleteClientModal = dynamic(() => import("@/components/modals/DeleteClientModal"), {
  ssr: false,
});

const DeleteDocumentModal = dynamic(() => import("@/components/modals/DeleteDocumentModal"), {
  ssr: false,
});

const DeleteAllDocumentsModal = dynamic(() => import("@/components/modals/DeleteAllDocumentsModal"), {
  ssr: false,
});

export default function ClientWorkspacePage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setCurrentDraftId = useDraftSessionStore(state => state.setCurrentDraftId);

  const clientIdParam = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const clientId = typeof clientIdParam === 'string' ? parseInt(clientIdParam, 10) : clientIdParam as number;

  const { client, isLoading: loading } = useClient(clientId);
  const uploadDocumentToStore = useClientStore(state => state.uploadDocument);
  const deleteDocumentFromStore = useClientStore(state => state.deleteDocument);
  const deleteClientFromStore = useClientStore(state => state.deleteClient);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [proposalSearchQuery, setProposalSearchQuery] = useState<string>("");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [clientProposals, setClientProposals] = useState<ProposalListItem[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState<boolean>(true);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [deleteClientModalOpen, setDeleteClientModalOpen] = useState<boolean>(false);
  const [deleteDocModalData, setDeleteDocModalData] = useState<{ id: number; name: string } | null>(null);
  const [deleteAllDocsModalOpen, setDeleteAllDocsModalOpen] = useState<boolean>(false);

  function handleNewProposal(): void {
    setCurrentDraftId(null); // Clear draft ID for new proposal
    setShowTemplateModal(true);
  }


  // Auto-load proposals immediately when component mounts
  useEffect(() => {
    loadClientProposals();
  }, [clientId]);

  async function loadClientProposals(): Promise<void> {
    setIsLoadingProposals(true);
    try {
      const proposals = await listProposals();
      const clientHistory = proposals.filter((p) => p.clientId === clientId);
      setClientProposals(clientHistory);
    } catch (error) {
      logger.error("Failed to load client proposals:", error);
    } finally {
      setIsLoadingProposals(false);
    }
  }


  function handleDeleteDocument(docId: number, docName: string): void {
    setDeleteDocModalData({ id: docId, name: docName });
  }

  async function confirmDeleteDocument(): Promise<void> {
    if (!client || !deleteDocModalData) return;

    try {
      await deleteDocumentFromStore(client.id, deleteDocModalData.id);
      toast.success("Document deleted");
      setDeleteDocModalData(null);
    } catch (error) {
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
      await Promise.all(client.documents.map((doc) => deleteDocumentFromStore(client.id, doc.id)));
      toast.success("All documents deleted");
      setDeleteAllDocsModalOpen(false);
    } catch (error) {
      logger.error("Failed to delete all documents:", error);
      toast.error("Failed to delete some documents");
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
        setUploadingFiles(prev => new Set(prev).add(fileId));
        toast.info(`Uploading ${file.name}...`);

        const uploadedDoc = await uploadDocumentToStore(client.id, file);

        // Show parsing status
        if (uploadedDoc.status === 'processing') {
          toast.info(`${file.name} is being parsed...`);
        } else if (uploadedDoc.status === 'parsed') {
          toast.success(`${file.name} uploaded and parsed successfully`);
        }
      } catch (error) {
        logger.error(`Failed to upload ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploadingFiles(prev => {
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
      fileInputRef.current.value = '';
    }
  }

  function getTemplateTypeLabel(proposal: ProposalListItem): string {
    // Use templateId to determine the actual template name
    if (proposal.templateId) {
      // Map template IDs to names
      const templateNames: Record<string, string> = {
        'saas': 'SaaS',
        'consulting': 'Consulting',
        'agency': 'Agency',
        'ecommerce': 'E-Commerce',
        'enterprise': 'Enterprise',
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

  if (loading) {
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

  const filteredProposals = clientProposals.filter((proposal) =>
    proposal.title.toLowerCase().includes(proposalSearchQuery.toLowerCase())
  );

  return (
    <PageLayout>
        <div className={styles.clientHeader}>
          <div className={styles.clientHeaderLeft}>
            <div className={styles.clientBadge}>
              <span className={styles.clientBadgeLabel}>Client Workspace</span>
              <span className={styles.clientBadgeStatus}>Active</span>
            </div>
            <h1 className={styles.clientName}>{client.name}</h1>
            <p className={styles.clientMeta}>{client.industry} • Active • Created {formatDate(client.createdAt)}</p>
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
                style={{ display: 'none' }}
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
                  const iconClass = doc.fileType === 'pdf' ? styles.iconPdf :
                                   doc.fileType === 'docx' ? styles.iconDocx :
                                   doc.fileType === 'xlsx' ? styles.iconXlsx :
                                   styles.iconDefault;

                  return (
                    <div key={doc.id} className={styles.documentItem}>
                      <div className={`${styles.documentIcon} ${iconClass}`}>
                        <FileText size={20} />
                      </div>
                      <div className={styles.documentInfo}>
                        <div className={styles.documentName}>{doc.name}</div>
                        <div className={styles.documentMeta}>
                          <span>{Math.round(doc.sizeBytes / 1024)} KB</span>
                          <span>•</span>
                          <span>{formatDate(doc.createdAt)}</span>
                        </div>
                      </div>
                      <div className={styles.documentStatus}>
                        {doc.status === 'parsed' ? (
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
            ) : filteredProposals.length === 0 ? (
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
                        key={proposal.id}
                        className={styles.proposalRow}
                        onClick={() => router.push(`/proposal/${proposal.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div className={styles.proposalName}>{proposal.title}</div>
                          <div className={styles.proposalVersion}>Version 1.0</div>
                        </td>
                        <td>
                          <span className={styles.typeBadge}>{getTemplateTypeLabel(proposal)}</span>
                        </td>
                        <td className={styles.dateCell}>
                          {formatDate(proposal.createdAt)}
                        </td>
                        <td>
                          <div className={styles.statusCell}>
                            {proposal.approvalStatus === 'approved' && (
                              <>
                                <CheckCircle size={16} className={styles.statusIconFinalized} />
                                <span>Finalized</span>
                              </>
                            )}
                            {proposal.approvalStatus === 'rejected' && (
                              <>
                                <Clock size={16} className={styles.statusIconReview} />
                                <span className={styles.statusReview}>In Review</span>
                              </>
                            )}
                            {proposal.approvalStatus === 'pending' && (
                              <>
                                <Clock size={16} className={styles.statusIconDraft} />
                                <span>Draft</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className={styles.actionsCol}>
                          <div className={styles.actionButtons}>
                            <button
                              className={styles.actionBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/api/proposals/${proposal.id}/download?format=pdf`, '_blank');
                              }}
                              title="Download as PDF"
                            >
                              <Download size={16} />
                              <span className={styles.actionLabel}>PDF</span>
                            </button>
                            <button
                              className={styles.actionBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/api/proposals/${proposal.id}/download?format=docx`, '_blank');
                              }}
                              title="Download as Word Document"
                            >
                              <FileDown size={16} />
                              <span className={styles.actionLabel}>DOCX</span>
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
              uploadedFiles: []
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
