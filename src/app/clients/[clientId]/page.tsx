"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Upload, Search, FileText, Edit, CheckCircle, Clock, X, Filter, Trash2 } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";

import { getClient, deleteClient, uploadDocument, deleteDocument, type ClientWithDocuments, type ClientDocument } from "@/api/clientApi";
import { listProposals } from "@/api/proposalApi";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

const EditClientModal = dynamic(() => import("@/components/modals/EditClientModal"), {
  ssr: false,
});

const TemplateSelectionModal = dynamic(() => import("@/components/modals/TemplateSelectionModal"), {
  ssr: false,
});

export default function ClientWorkspacePage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [client, setClient] = useState<ClientWithDocuments | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [clientProposals, setClientProposals] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadClient();
  }, [params.clientId]);

  useEffect(() => {
    if (client) {
      loadClientProposals();
    }
  }, [client]);

  async function loadClientProposals(): Promise<void> {
    if (!client) return;
    
    try {
      const proposals = await listProposals();
      const clientHistory = proposals.filter((p) => p.clientId === client.id);
      setClientProposals(clientHistory);
    } catch (error) {
      console.error("Failed to load client proposals:", error);
    }
  }

  async function loadClient(): Promise<void> {
    try {
      setLoading(true);
      const clientIdParam = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
      const clientId = typeof clientIdParam === 'string' ? parseInt(clientIdParam, 10) : clientIdParam as number;
      const loadedClient = await getClient(clientId);
      setClient(loadedClient);
    } catch (error) {
      console.error("Failed to load client:", error);
      toast.error("Client not found");
      router.push("/clients");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDocument(docId: number): Promise<void> {
    if (!client) return;

    try {
      await deleteDocument(client.id, docId);
      toast.success("Document deleted");
      await loadClient();
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast.error("Failed to delete document");
    }
  }

  async function handleDeleteAllDocuments(): Promise<void> {
    if (!client || client.documents.length === 0) return;

    if (!confirm("Are you sure you want to delete all documents?")) return;

    try {
      await Promise.all(client.documents.map((doc) => deleteDocument(client.id, doc.id)));
      toast.success("All documents deleted");
      await loadClient();
    } catch (error) {
      console.error("Failed to delete all documents:", error);
      toast.error("Failed to delete some documents");
    }
  }

  async function handleDeleteClient(): Promise<void> {
    if (!client) return;

    if (!confirm("Are you sure you want to delete this client? This action cannot be undone.")) return;

    try {
      await deleteClient(client.id);
      toast.success("Client deleted");
      router.push("/clients");
    } catch (error) {
      console.error("Failed to delete client:", error);
      toast.error("Failed to delete client");
    }
  }

  async function handleFileUpload(files: FileList | null): Promise<void> {
    if (!files || !client) return;

    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      try {
        setUploadingFiles(prev => new Set(prev).add(file.name));
        const result = await uploadDocument(client.id, file);
        toast.success(`${file.name} uploaded successfully`);
        await loadClient();
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploadingFiles(prev => {
          const next = new Set(prev);
          next.delete(file.name);
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

  if (loading) {
    return (
      <div className="app-container">
        <MainSidebar />
        <main className="main-content">
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>Loading client...</div>
          </div>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="app-container">
        <MainSidebar />
        <main className="main-content">
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>Client not found</div>
          </div>
        </main>
      </div>
    );
  }

  const filteredDocuments = client.documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app-container">
      <MainSidebar />
      <main className="main-content">
        <div className={styles.clientHeader}>
          <div className={styles.clientHeaderLeft}>
            <div className={styles.clientBadge}>
              <span className={styles.clientBadgeLabel}>Client Workspace</span>
              <span className={styles.clientBadgeStatus}>Active</span>
            </div>
            <h1 className={styles.clientName}>{client.name}</h1>
            <p className={styles.clientMeta}>{client.industry} • Active • Created {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div className={styles.clientHeaderActions}>
            <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
              <Edit size={18} />
              Edit Details
            </button>
            <button className="btn btn-primary" onClick={() => setShowTemplateModal(true)}>
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

            {filteredDocuments.length === 0 ? (
              <div className={styles.emptyState}>
                <FileText size={48} />
                <p>No documents yet</p>
                <p>Upload documents to build context</p>
              </div>
            ) : (
              <div className={styles.documentList}>
                {filteredDocuments.map((doc) => {
                  const iconClass = doc.file_type === 'pdf' ? styles.iconPdf :
                                   doc.file_type === 'docx' ? styles.iconDocx :
                                   doc.file_type === 'xlsx' ? styles.iconXlsx :
                                   styles.iconDefault;
                  
                  return (
                    <div key={doc.id} className={styles.documentItem}>
                      <div className={`${styles.documentIcon} ${iconClass}`}>
                        <FileText size={20} />
                      </div>
                      <div className={styles.documentInfo}>
                        <div className={styles.documentName}>{doc.name}</div>
                        <div className={styles.documentMeta}>
                          <span>{Math.round(doc.size_bytes / 1024)} KB</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                          handleDeleteDocument(doc.id);
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
                  />
                </div>
                <button className={styles.filterBtn}>
                  <Filter size={18} />
                </button>
              </div>
            </div>

            {clientProposals.length === 0 ? (
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
                    {clientProposals.map((proposal) => (
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
                          <span className={styles.typeBadge}>BRD</span>
                        </td>
                        <td className={styles.dateCell}>
                          {new Date(proposal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                                // Download PDF
                              }}
                              title="Download PDF"
                            >
                              <FileText size={18} />
                            </button>
                            <button 
                              className={styles.actionBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Download Word
                              }}
                              title="Download Word"
                            >
                              <FileText size={18} />
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
            client={client as any}
            onClose={() => setShowEditModal(false)}
            onClientUpdated={() => {
              loadClient();
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
      </main>
    </div>
  );
}
