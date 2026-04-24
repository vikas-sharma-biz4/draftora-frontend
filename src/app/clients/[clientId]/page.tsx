"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Upload, Search, Filter, FileText, Download, Edit, CheckCircle, Clock, X } from "lucide-react";
import { toast } from "sonner";

import styles from "./page.module.scss";

import type { Client, ClientDocument, ProposalHistoryItem } from "@/types/client.types";
import { CLIENTS_STORAGE_KEY, HISTORY_STORAGE_KEY } from "@/constants";
import { getDownloadUrl } from "@/api/proposalApi";
import { parseFiles } from "@/services/api";
import {
  PARSING_BASE_TIME_MS,
  PARSING_DEFAULT_BASE_TIME_MS,
  PARSING_LARGE_SIZE_MULTIPLIER,
  PARSING_SIZE_MULTIPLIERS,
  PARSING_VARIANCE,
} from "@/config/config";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

export default function ClientWorkspacePage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [client, setClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [clientProposals, setClientProposals] = useState<any[]>([]);

  useEffect(() => {
    loadClient();
  }, [params.clientId]);

  useEffect(() => {
    if (client) {
      loadClientProposals();
    }
  }, [client]);

  function loadClientProposals(): void {
    if (!client) return;
    
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
      const clientHistory = history.filter((item: any) => 
        item.clientName === client.name || 
        item.data?.clientName === client.name
      );
      setClientProposals(clientHistory);
    } catch (error) {
      console.error("Failed to load client proposals:", error);
    }
  }

  function loadClient(): void {
    try {
      const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
      const clients = raw ? (JSON.parse(raw) as Client[]) : [];
      const found = clients.find((c) => c.id === params.clientId);
      if (found) {
        setClient(found);
      } else {
        toast.error("Client not found");
        router.push("/clients");
      }
    } catch {
      toast.error("Failed to load client");
    }
  }

  function handleUploadClick(): void {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newFiles = Array.from(files);
    console.log(`[FILE SELECTION] ${newFiles.length} file(s) selected:`, newFiles.map(f => ({
      name: f.name,
      size: formatFileSize(f.size),
      type: f.type
    })));
    
    setPendingFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
    
    toast.success(`${newFiles.length} file(s) selected. Click "Upload" to start parsing.`);
  }

  function calculateParsingTime(file: File): number {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const sizeInMB = file.size / (1024 * 1024);

    // Complexity multiplier based on file size
    let complexityMultiplier = PARSING_LARGE_SIZE_MULTIPLIER;
    for (const [threshold, multiplier] of PARSING_SIZE_MULTIPLIERS) {
      if (sizeInMB < threshold) {
        complexityMultiplier = multiplier;
        break;
      }
    }

    const baseTime = PARSING_BASE_TIME_MS[ext || "pdf"] ?? PARSING_DEFAULT_BASE_TIME_MS;
    const calculatedTime = baseTime * complexityMultiplier;

    // Add random variance (±20%)
    const variance = calculatedTime * PARSING_VARIANCE;
    const finalTime = calculatedTime + (Math.random() * variance * 2 - variance);

    return Math.round(finalTime);
  }

  async function handleUploadDocuments(): Promise<void> {
    if (pendingFiles.length === 0) {
      toast.error("No files selected");
      return;
    }

    console.log(`[UPLOAD START] Uploading ${pendingFiles.length} file(s) for client: ${client?.name}`);
    console.log('[UPLOAD FILES]', pendingFiles.map(f => f.name));

    // Add all files to UI with "processing" status
    const fileDocuments: Array<{ fileId: string; file: File; doc: ClientDocument }> = [];
    
    pendingFiles.forEach((file, index) => {
      const fileId = `${Date.now()}-${Math.random()}-${file.name}`;
      setUploadingFiles((prev) => new Set(prev).add(fileId));

      const ext = file.name.split(".").pop()?.toLowerCase() as "pdf" | "docx" | "xlsx" | "pptx";
      const sizeInMB = file.size / (1024 * 1024);
      
      const newDoc: ClientDocument = {
        id: fileId,
        name: file.name,
        size: formatFileSize(file.size),
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        status: "processing",
        fileType: ext || "pdf",
        selected: false,
      };

      console.log(`[DOCUMENT ${index + 1}/${pendingFiles.length}] Added to processing queue:`, {
        id: fileId,
        name: file.name,
        size: formatFileSize(file.size),
        sizeInMB: sizeInMB.toFixed(2) + ' MB',
        type: ext,
        status: 'processing'
      });

      fileDocuments.push({ fileId, file, doc: newDoc });

      setClient((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          documents: [...prev.documents, newDoc],
        };
      });
    });

    // Persist documents to localStorage immediately for durability
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const clients = raw ? (JSON.parse(raw) as Client[]) : [];
    const updatedClients = clients.map((c) =>
      c.id === params.clientId
        ? {
            ...c,
            documents: [...c.documents, ...fileDocuments.map(fd => fd.doc)],
          }
        : c
    );
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updatedClients));

    toast.success(`Uploading ${pendingFiles.length} file(s)...`);
    const filesToParse = [...pendingFiles];
    setPendingFiles([]);

    // Call backend API to parse files
    try {
      console.log('[BACKEND] Sending files to backend API for parsing...');
      const parseResponse = await parseFiles(filesToParse);
      
      console.log('[BACKEND] Parse response received:', parseResponse);

      // Update each successfully parsed document
      parseResponse.results.forEach((result) => {
        const fileDoc = fileDocuments.find(fd => fd.file.name === result.filename);
        if (!fileDoc) return;

        console.log(`[PARSING COMPLETE] ✓ Successfully parsed: "${result.filename}"`, {
          charCount: result.char_count,
          wordCount: result.word_count,
          textLength: result.text.length,
          preview: result.preview
        });
        
        handleParsingComplete(fileDoc.fileId, result.filename, result.text);
      });

      // Handle any errors
      parseResponse.errors.forEach((error) => {
        const fileDoc = fileDocuments.find(fd => fd.file.name === error.filename);
        if (!fileDoc) return;

        console.error(`[PARSING FAILED] ✗ Failed to parse: "${error.filename}"`, error.error);
        handleParsingError(fileDoc.fileId, error.filename, error.error);
      });
    } catch (error) {
      console.error('[BACKEND ERROR] Failed to parse files:', error);
      toast.error('Failed to connect to backend. Please ensure the API is running.');
      
      // Mark all files as failed
      fileDocuments.forEach(({ fileId, file }) => {
        handleParsingError(fileId, file.name, 'Backend connection failed');
      });
    }
  }

  function handleParsingComplete(fileId: string, fileName: string, extractedText: string): void {
    setClient((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map((doc) =>
          doc.id === fileId ? { ...doc, status: "parsed" as const } : doc
        ),
      };
    });

    setUploadingFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });

    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const clients = raw ? (JSON.parse(raw) as Client[]) : [];
    const updated = clients.map((c) =>
      c.id === params.clientId
        ? {
            ...c,
            documents: c.documents.map((doc) =>
              doc.id === fileId ? { ...doc, status: "parsed" as const } : doc
            ),
          }
        : c
    );
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updated));

    console.log(`[STORAGE UPDATED] Document saved to localStorage for client: ${client?.name}`);
    console.log(`[EXTRACTED TEXT] Length: ${extractedText.length} characters`);
    
    toast.success(`"${fileName}" parsed successfully`);
  }

  function handleParsingError(fileId: string, fileName: string, error: string): void {
    setClient((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.filter((doc) => doc.id !== fileId),
      };
    });

    setUploadingFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });

    // Remove failed document from localStorage
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const clients = raw ? (JSON.parse(raw) as Client[]) : [];
    const updated = clients.map((c) =>
      c.id === params.clientId
        ? {
            ...c,
            documents: c.documents.filter((doc) => doc.id !== fileId),
          }
        : c
    );
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updated));

    console.error(`[PARSING ERROR] Failed to parse "${fileName}":`, error);
    toast.error(`Failed to parse "${fileName}": ${error}`);
  }

  function handleRemovePendingFile(index: number): void {
    const removedFile = pendingFiles[index];
    console.log(`[PENDING FILE REMOVED] Removed from queue: "${removedFile.name}"`);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    toast.info(`Removed "${removedFile.name}" from upload queue`);
  }

  function handleCancelAllPending(): void {
    console.log(`[CANCEL ALL] Removing all ${pendingFiles.length} pending files:`, pendingFiles.map(f => f.name));
    setPendingFiles([]);
    toast.info(`Cancelled upload of ${pendingFiles.length} file(s)`);
  }

  function simulateParsing(fileId: string, fileName: string, fileType: string, fileSize: string): void {
    const startTime = Date.now();
    console.log(`[PARSING START] Starting to parse: "${fileName}"`, {
      id: fileId,
      type: fileType,
      size: fileSize,
      timestamp: new Date().toISOString()
    });
    
    setClient((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map((doc) =>
          doc.id === fileId ? { ...doc, status: "parsed" as const } : doc
        ),
      };
    });

    setUploadingFiles((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });

    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const clients = raw ? (JSON.parse(raw) as Client[]) : [];
    const updated = clients.map((c) =>
      c.id === params.clientId
        ? {
            ...c,
            documents: c.documents.map((doc) =>
              doc.id === fileId ? { ...doc, status: "parsed" as const } : doc
            ),
          }
        : c
    );
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updated));

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`[PARSING COMPLETE] ✓ Successfully parsed: "${fileName}"`, {
      type: fileType,
      size: fileSize,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });
    console.log(`[STORAGE UPDATED] Document saved to localStorage for client: ${client?.name}`);
    
    toast.success(`"${fileName}" parsed successfully`);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getFileIcon(fileType: string): JSX.Element {
    switch (fileType) {
      case "pdf":
        return <FileText className={styles.iconPdf} />;
      case "docx":
        return <FileText className={styles.iconDocx} />;
      case "xlsx":
        return <FileText className={styles.iconXlsx} />;
      default:
        return <FileText className={styles.iconDefault} />;
    }
  }

  function handleNewProposal(): void {
    router.push("/home");
  }

  function handleDeleteDocument(docId: string): void {
    const doc = client?.documents.find(d => d.id === docId);
    if (!doc) return;

    if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      console.log(`[DELETE CANCELLED] User cancelled deletion of: "${doc.name}"`);
      return;
    }

    console.log(`[DELETE START] Deleting document:`, {
      id: docId,
      name: doc.name,
      size: doc.size,
      status: doc.status
    });

    setClient((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.filter((d) => d.id !== docId),
      };
    });

    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const clients = raw ? (JSON.parse(raw) as Client[]) : [];
    const updated = clients.map((c) =>
      c.id === params.clientId
        ? {
            ...c,
            documents: c.documents.filter((d) => d.id !== docId),
          }
        : c
    );
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updated));

    console.log(`[DELETE COMPLETE] ✓ Successfully deleted: "${doc.name}"`);
    console.log(`[STORAGE UPDATED] Removed from localStorage for client: ${client?.name}`);
    
    toast.success(`"${doc.name}" deleted`);
  }

  function handleDeleteAllDocuments(): void {
    if (!client || client.documents.length === 0) return;

    if (!confirm(`Are you sure you want to delete ALL ${client.documents.length} documents?`)) {
      console.log(`[BULK DELETE CANCELLED] User cancelled bulk deletion`);
      return;
    }

    console.log(`[BULK DELETE START] Deleting all ${client.documents.length} documents:`, 
      client.documents.map(d => ({ name: d.name, status: d.status }))
    );

    setClient((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: [],
      };
    });

    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const clients = raw ? (JSON.parse(raw) as Client[]) : [];
    const updated = clients.map((c) =>
      c.id === params.clientId
        ? {
            ...c,
            documents: [],
          }
        : c
    );
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updated));

    console.log(`[BULK DELETE COMPLETE] ✓ Successfully deleted all documents`);
    console.log(`[STORAGE UPDATED] Cleared all documents for client: ${client?.name}`);
    
    toast.success(`All ${client.documents.length} documents deleted`);
  }

  const filteredProposals = clientProposals.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!client) {
    return (
      <div className="app-container">
        <MainSidebar />
        <main className="main-content">
          <div className={styles.loading}>Loading client...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <MainSidebar />
      <main className={styles.clientWorkspace}>
        <div className={styles.clientHeader}>
          <div className={styles.clientHeaderLeft}>
            <div className={styles.clientBadge}>
              <span className={styles.clientBadgeLabel}>Client Workspace</span>
              <span className={styles.clientBadgeStatus}>Active</span>
            </div>
            <h1 className={styles.clientName}>{client.name}</h1>
            <p className={styles.clientMeta}>
              {client.industry} • {client.tier} • Onboarded {client.onboardedDate}
            </p>
          </div>
          <div className={styles.clientHeaderActions}>
            <button className="btn btn-secondary">Edit Details</button>
            <button className="btn btn-primary" onClick={handleNewProposal}>
              New Proposal
            </button>
          </div>
        </div>

        <div className={styles.splitLayout}>
          <section className={styles.knowledgeBase}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Knowledge Base</h2>
                <p className={styles.panelSubtitle}>Source documents for context generation</p>
              </div>
              <div className={styles.headerActions}>
                {client.documents.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleDeleteAllDocuments}
                    title="Delete all documents"
                  >
                    Delete All
                  </button>
                )}
                <button
                  className={styles.uploadBtn}
                  onClick={handleUploadClick}
                  title="Upload Asset"
                >
                  <Upload size={20} />
                </button>
              </div>
            </div>

            {pendingFiles.length > 0 && (
              <div className={styles.pendingSection}>
                <div className={styles.pendingSectionHeader}>
                  <span className={styles.pendingCount}>{pendingFiles.length} file(s) selected</span>
                  <div className={styles.pendingActions}>
                    <button className="btn btn-ghost btn-sm" onClick={handleCancelAllPending}>
                      Cancel All
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleUploadDocuments}>
                      Upload & Parse
                    </button>
                  </div>
                </div>
                <div className={styles.pendingFilesList}>
                  {pendingFiles.map((file, index) => (
                    <div key={index} className={styles.pendingFileItem}>
                      <FileText size={16} />
                      <span className={styles.pendingFileName}>{file.name}</span>
                      <span className={styles.pendingFileSize}>({formatFileSize(file.size)})</span>
                      <button
                        className={styles.removePendingBtn}
                        onClick={() => handleRemovePendingFile(index)}
                        title="Remove"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.documentList}>
              {client.documents.map((doc) => (
                <div key={doc.id} className={styles.documentItem}>
                  <div className={styles.documentIcon}>
                    {getFileIcon(doc.fileType)}
                  </div>
                  <div className={styles.documentInfo}>
                    <h3 className={styles.documentName}>{doc.name}</h3>
                    <div className={styles.documentMeta}>
                      <span>{doc.size}</span>
                      <span>•</span>
                      <span>{doc.date}</span>
                    </div>
                  </div>
                  <div className={styles.documentStatus}>
                    {doc.status === "parsed" ? (
                      <span className={styles.statusParsed}>
                        <span className={styles.statusDot} />
                        PARSED
                      </span>
                    ) : (
                      <span className={styles.statusProcessing}>
                        <span className={styles.statusDotProcessing} />
                        PROCESSING
                      </span>
                    )}
                  </div>
                  <button
                    className={styles.deleteDocBtn}
                    onClick={() => handleDeleteDocument(doc.id)}
                    title="Delete document"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </section>

          <section className={styles.proposalHistory}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Proposal History</h2>
                <p className={styles.panelSubtitle}>Recent outputs and generated drafts</p>
              </div>
              <div className={styles.searchBar}>
                <div className={styles.searchInput}>
                  <Search size={16} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search proposals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className={styles.filterBtn}>
                  <Filter size={18} />
                </button>
              </div>
            </div>

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
                  {filteredProposals.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>
                        No proposals found for this client
                      </td>
                    </tr>
                  ) : (
                    filteredProposals.map((proposal) => {
                      const date = new Date(proposal.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                      
                      return (
                        <tr key={proposal.id} className={styles.proposalRow}>
                          <td>
                            <div className={styles.proposalName}>{proposal.title}</div>
                            <div className={styles.proposalVersion}>ID: {proposal.proposalId}</div>
                          </td>
                          <td>
                            <span className={styles.typeBadge}>Proposal</span>
                          </td>
                          <td className={styles.dateCell}>{date}</td>
                          <td>
                            <div className={styles.statusCell}>
                              {proposal.status === "approved" && (
                                <>
                                  <CheckCircle size={16} className={styles.statusIconFinalized} />
                                  <span>Approved</span>
                                </>
                              )}
                              {proposal.status === "rejected" && (
                                <>
                                  <X size={16} className={styles.statusIconDraft} />
                                  <span>Rejected</span>
                                </>
                              )}
                              {proposal.status === "pending_approval" && (
                                <>
                                  <Clock size={16} className={styles.statusIconReview} />
                                  <span className={styles.statusReview}>Pending Approval</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className={styles.actionsCol}>
                            <div className={styles.actionButtons}>
                              <button 
                                className={styles.actionBtn} 
                                title="View Proposal"
                                onClick={() => router.push(`/proposal/${proposal.proposalId}`)}
                              >
                                <FileText size={18} />
                              </button>
                              <a
                                href={getDownloadUrl(proposal.proposalId)}
                                className={styles.actionBtn}
                                title="Download DOCX"
                                download
                                onClick={() => toast.success("Downloading proposal...")}
                              >
                                <Download size={18} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
