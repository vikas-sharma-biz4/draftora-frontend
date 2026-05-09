"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Upload, Search, FileText, Edit, CheckCircle, Clock, X } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";

import { getClient, uploadDocument, deleteDocument, type ClientWithDocuments, type ClientDocument } from "@/services/clientApi";
import { listProposals } from "@/services/proposalApi";
import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

const EditClientModal = dynamic(() => import("@/components/modals/EditClientModal"), {
  ssr: false,
});

export default function ClientWorkspacePage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [client, setClient] = useState<ClientWithDocuments | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [clientProposals, setClientProposals] = useState<ProposalListItem[]>([]);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
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
      const rawId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
      const clientId = parseInt(rawId, 10);
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

  async function handleFileUpload(files: FileList | null): Promise<void> {
    if (!files || !client) return;

    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      try {
        setUploadingFiles(prev => new Set(prev).add(file.name));
        await uploadDocument(client.id, file);
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
        <div className={styles.header}>
          <div>
            <h1 className="page-title">{client.name}</h1>
            <p className="page-subtitle">{client.industry}</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
            <Edit size={18} />
            Edit Client
          </button>
        </div>

        <div className={styles.documentsSection}>
          <div className={styles.sectionHeader}>
            <h2>Documents</h2>
            <button 
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles.size > 0}
            >
              <Upload size={18} />
              {uploadingFiles.size > 0 ? `Uploading ${uploadingFiles.size}...` : 'Upload Document'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
              multiple
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className={styles.searchBar}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredDocuments.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>No documents yet</div>
              <div className={styles.emptyDesc}>
                Upload documents to get started
              </div>
            </div>
          ) : (
            <div className={styles.documentsGrid}>
              {filteredDocuments.map((doc) => (
                <div key={doc.id} className={styles.documentCard}>
                  <div className={styles.documentIcon}>
                    <FileText size={24} />
                  </div>
                  <div className={styles.documentInfo}>
                    <h3>{doc.name}</h3>
                    <p>{doc.file_type.toUpperCase()} • {Math.round(doc.size_bytes / 1024)} KB</p>
                    <span className={`${styles.status} ${styles[doc.status]}`}>
                      {doc.status === 'parsed' ? <CheckCircle size={14} /> : <Clock size={14} />}
                      {doc.status}
                    </span>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteDocument(doc.id)}
                    title="Delete document"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
      </main>
    </div>
  );
}
