"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Plus, CheckSquare, Square, Upload, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import styles from "./TemplateSelectionModal.module.scss";

import { listClientsWithDocuments, invalidateClientsCache, uploadDocument, type ClientWithDocuments } from "@/api/clientApi";
import { PROPOSAL_TEMPLATES } from "@/constants";
import { useProposal } from "@/context/ProposalContext";
import { parseFiles } from "@/services/api";
import type { ParsedFileResult } from "@/services/api";

interface TemplateSelectionModalProps {
  templateId?: string | null;
  templateName?: string;
  onClose: () => void;
  onNewClient: () => void;
  initialClients?: ClientWithDocuments[];
  isScratch?: boolean;
}

export default function TemplateSelectionModal({
  templateId,
  templateName,
  onClose,
  onNewClient,
  initialClients,
  isScratch = false,
}: TemplateSelectionModalProps): JSX.Element | null {
  const router = useRouter();
  const { updateProposalData, setCurrentStep, setDraftStage, markStepCompleted } = useProposal();
  
  const [mounted, setMounted] = useState<boolean>(false);
  const [clients, setClients] = useState<ClientWithDocuments[]>(initialClients ?? []);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(initialClients === undefined);
  const [proposalName, setProposalName] = useState<string>("");
  const [proposalDescription, setProposalDescription] = useState<string>("");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<
    { file: File; id: string; status: "pending" | "parsing" | "parsed" | "error"; error?: string; parsedData?: ParsedFileResult }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processedFilesRef = useRef<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (initialClients !== undefined) return; // Already provided by parent — skip fetch
    loadClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when parent's background re-fetch completes (e.g. after new client created)
  useEffect(() => {
    if (initialClients !== undefined) {
      setClients(initialClients);
      setLoading(false);
    }
  }, [initialClients]);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId);
      if (client && client.documents) {
        const allDocIds = new Set(client.documents.filter((d) => d.status === "parsed").map((d) => d.id));
        setSelectedDocuments(allDocIds);
      }
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".pptx"];
  const ACCEPTED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  /**
   * Validates file extension and size against proposal upload rules.
   * Accepted: PDF, DOCX, XLSX, PPTX ≤ 10 MB. Emits toast on rejection.
   * @param file Candidate file from drag-and-drop or input change
   * @returns    `true` if extension and size pass
   */
  function isValidFile(file: File): boolean {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);
    const sizeOk = file.size <= MAX_FILE_SIZE;
    if (!typeOk) {
      toast.error(`"${file.name}" is not a supported file type`);
      return false;
    }
    if (!sizeOk) {
      toast.error(`"${file.name}" exceeds 10 MB limit`);
      return false;
    }
    return true;
  }

  function processFileList(files: FileList | null): void {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter(isValidFile);
    if (validFiles.length === 0) return;

    const newFiles = validFiles.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: "pending" as const,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => startRealParsing(f.file, f.id));
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    processFileList(e.dataTransfer.files);
  }

  /**
   * Loads client list from API with documents.
   * Uses module-level cache when available to avoid redundant API calls.
   */
  async function loadClients(): Promise<void> {
    try {
      setLoading(true);
      const clientsWithDocs = await listClientsWithDocuments();
      setClients(clientsWithDocs);
    } catch (error) {
      console.error("Failed to load clients:", error);
      toast.error("Failed to load clients");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Commits a client selection, closes the dropdown, and auto-selects
   * all parsed documents belonging to that client.
   * @param clientId   ID of the selected client
   * @param clientName Display name used for the search input value
   */
  function handleClientSelect(clientId: number, clientName: string): void {
    setSelectedClientId(clientId);
    setClientSearchQuery(clientName);
    setShowClientDropdown(false);
  }

  function handleClientSearchChange(value: string): void {
    setClientSearchQuery(value);
    setShowClientDropdown(true);
    if (!value.trim()) {
      setSelectedClientId(null);
    }
  }

  function handleClientSearchFocus(): void {
    setShowClientDropdown(true);
  }

  function handleClientSearchBlur(): void {
    setTimeout(() => setShowClientDropdown(false), 200);
  }

  function toggleDocument(docId: number): void {
    setSelectedDocuments((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }

  function toggleAllDocuments(): void {
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client || !client.documents) return;

    const parsedDocs = client.documents.filter((d) => d.status === "parsed");
    if (selectedDocuments.size === parsedDocs.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(parsedDocs.map((d) => d.id)));
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    processFileList(e.target.files);
    e.target.value = "";
  }

  // Native backup listener — catches events that React's synthetic system misses
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    const onNativeChange = (evt: Event) => {
      const target = evt.target as HTMLInputElement;
      const files = target.files;
      if (!files || files.length === 0) return;

      const fingerprint = Array.from(files)
        .map((f) => `${f.name}-${f.size}-${f.lastModified}`)
        .join("|");
      if (processedFilesRef.current.has(fingerprint)) return;
      processedFilesRef.current.add(fingerprint);
      setTimeout(() => processedFilesRef.current.delete(fingerprint), 150);

      processFileList(files);
      target.value = "";
    };

    input.addEventListener("change", onNativeChange);
    return () => input.removeEventListener("change", onNativeChange);
  }, []);

  /**
   * Uploads a single file to the parse API, tracks progress in
   * `uploadedFiles`, and auto-attaches successful results to the
   * currently selected client. Surfaces server and network errors
   * via toast notifications.
   * @param file   Raw File object from input or drag-and-drop
   * @param fileId Stable local identifier for optimistic UI tracking
   */
  async function startRealParsing(file: File, fileId: string): Promise<void> {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "parsing" } : f))
    );

    try {
      const response = await parseFiles([file]);

      if (response.errors.length > 0) {
        const errMsg = response.errors[0].error;
        setUploadedFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: errMsg } : f))
        );
        toast.error(`Failed to parse "${file.name}": ${errMsg}`);
        return;
      }

      const result = response.results[0];
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "parsed", parsedData: result } : f))
      );
      toast.success(`"${file.name}" parsed — ${result.word_count} words`);

      // Save to the selected client so it appears in Knowledge Base list
      saveParsedDocumentToClient(file, fileId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backend connection failed";
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: message } : f))
      );
      toast.error(`Backend error parsing "${file.name}"`);
    }
  }

  async function saveParsedDocumentToClient(file: File, fileId: string, result: ParsedFileResult): Promise<void> {
    if (!selectedClientId) return;

    try {
      const uploadResult = await uploadDocument(selectedClientId, file);
      
      // Invalidate cache then reload to get updated document list
      invalidateClientsCache();
      await loadClients();
      
      // Auto-select newly uploaded document
      setSelectedDocuments((prev) => {
        const next = new Set(prev);
        next.add(uploadResult.id);
        return next;
      });
      
      // Remove from uploaded files list (auto-move to selected documents)
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
      
      toast.success(`${file.name} uploaded and added to selected documents`);
    } catch (error) {
      console.error("Failed to upload document:", error);
      toast.error(`Failed to upload ${file.name}`);
    }
  }

  function handleRemoveFile(fileId: string): void {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  function handleRemoveAllFiles(): void {
    setUploadedFiles([]);
    toast.info("All uploaded files removed");
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  /**
   * Validates form state, persists proposal metadata to context,
   * and routes the user to the parameter wizard (step 4).
   * Triggers toast errors for missing client, name, or documents.
   */
  function handleContinue(): void {
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }

    if (!proposalName.trim()) {
      toast.error("Please enter a proposal name");
      return;
    }

    if (selectedDocuments.size === 0) {
      toast.error("Please select at least one document");
      return;
    }

    const stillParsing = uploadedFiles.some((f) => f.status === "parsing");
    if (stillParsing) {
      toast.error("Please wait for all uploaded files to finish parsing");
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    const selectedDocIds = Array.from(selectedDocuments);
    const selectedDocsMeta = (client.documents || [])
      .filter((doc) => selectedDocIds.includes(doc.id))
      .map((doc) => ({
        name: doc.name,
        size: doc.size_bytes,
        type: doc.file_type ? `application/${doc.file_type}` : "application/pdf",
      }));

    const template = templateId ? PROPOSAL_TEMPLATES.find((t) => t.id === templateId) : null;

    updateProposalData({
      title: proposalName,
      clientName: client.name,
      description: proposalDescription,
      clientId: selectedClientId,
      templateId: isScratch ? null : templateId ?? null,
      templateType: isScratch ? "scratch" : "predefined",
      selectedSections: template ? [...template.sections] : [],
      sectionDisplayNames: {},
      selectedDocumentIds: selectedDocIds,
      filesMeta: selectedDocsMeta,
    });

    setDraftStage("wizard_in_progress");
    setCurrentStep(4);
    router.push("/parameters");
    onClose();
  }

  function handleNewClientClick(): void {
    onClose();
    onNewClient();
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              {isScratch ? "Start From Scratch" : "Create Proposal from Template"}
            </h2>
            <p className={styles.modalSubtitle}>
              {isScratch
                ? "Build a proposal without a predefined template"
                : <>Using <strong>{templateName}</strong> template</>}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.section}>
            <label className={styles.label}>Client Name</label>
            {loading ? (
              <div className={styles.noClients}>
                <p>Loading clients...</p>
              </div>
            ) : clients.length === 0 ? (
              <div className={styles.noClients}>
                <p>No clients found. Create your first client to continue.</p>
                <button className="btn btn-primary btn-sm" onClick={handleNewClientClick}>
                  <Plus size={16} />
                  New Client
                </button>
              </div>
            ) : (
              <div className={styles.searchWrapper}>
                <div className={styles.searchInputWrapper}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search for a client..."
                    value={clientSearchQuery}
                    onChange={(e) => handleClientSearchChange(e.target.value)}
                    onFocus={handleClientSearchFocus}
                    onBlur={handleClientSearchBlur}
                  />
                  <button className={styles.newClientBtn} onClick={handleNewClientClick}>
                    <Plus size={16} />
                    New Client
                  </button>
                </div>

                {showClientDropdown && filteredClients.length > 0 && (
                  <div className={styles.clientDropdown}>
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className={`${styles.clientOption} ${selectedClientId === client.id ? styles.selected : ""}`}
                        onClick={() => handleClientSelect(client.id, client.name)}
                      >
                        <div className={styles.clientOptionMain}>
                          <span className={styles.clientOptionName}>{client.name}</span>
                          <span className={styles.clientOptionIndustry}>{client.industry}</span>
                        </div>
                        <div className={styles.clientOptionMeta}>
                          {client.documents?.length || 0} docs
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showClientDropdown && filteredClients.length === 0 && clientSearchQuery.trim() && (
                  <div className={styles.clientDropdown}>
                    <div className={styles.noResults}>
                      No clients found matching "{clientSearchQuery}"
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <label className={styles.label}>Proposal Name</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Q4 Digital Transformation Initiative"
              value={proposalName}
              onChange={(e) => setProposalName(e.target.value)}
            />
          </div>

          <div className={styles.section}>
            <label className={styles.label}>Project Brief</label>
            <textarea
              className={styles.textarea}
              placeholder="Describe the project scope, client's core challenge, desired outcomes, technical constraints, and any specific requirements..."
              value={proposalDescription}
              onChange={(e) => setProposalDescription(e.target.value)}
            />
          </div>

          {selectedClient && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <label className={styles.label}>Knowledge Base Selection</label>
                <button className={styles.toggleAllBtn} onClick={toggleAllDocuments}>
                  {selectedDocuments.size === (selectedClient.documents?.filter((d) => d.status === "parsed").length || 0)
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              <p className={styles.hint}>
                Choose which documents to include as context for this proposal
              </p>

              <div className={styles.documentList}>
                {(selectedClient.documents?.filter((d) => d.status === "parsed").length || 0) === 0 ? (
                  <div className={styles.noDocuments}>
                    No parsed documents available for this client.
                  </div>
                ) : (
                  (selectedClient.documents || [])
                    .filter((d) => d.status === "parsed")
                    .map((doc) => (
                      <div
                        key={doc.id}
                        className={`${styles.documentItem} ${selectedDocuments.has(doc.id) ? styles.selected : ""}`}
                        onClick={() => toggleDocument(doc.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") toggleDocument(doc.id);
                        }}
                      >
                        <div className={styles.checkbox}>
                          {selectedDocuments.has(doc.id) ? (
                            <CheckSquare size={18} className={styles.checkboxChecked} />
                          ) : (
                            <Square size={18} className={styles.checkboxUnchecked} />
                          )}
                        </div>
                        <div className={styles.documentInfo}>
                          <div className={styles.documentName} title={doc.name}>{doc.name}</div>
                          <div className={styles.documentMeta}>
                            {formatFileSize(doc.size_bytes)} • {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {selectedDocuments.size > 0 && (
                <div className={styles.selectionSummary}>
                  {selectedDocuments.size} document{selectedDocuments.size !== 1 ? "s" : ""} selected
                </div>
              )}

              {/* Upload Additional Documents */}
              <div className={styles.uploadSection}>
                <div className={styles.uploadHeader}>
                  <label className={styles.label}>Upload Additional Documents</label>
                  {uploadedFiles.length > 0 && (
                    <button className={styles.removeAllBtn} onClick={handleRemoveAllFiles}>
                      Remove All
                    </button>
                  )}
                </div>
                <p className={styles.hint}>Upload new documents that will be parsed automatically</p>

                <label
                  htmlFor="template-file-upload"
                  className={`${styles.uploadZone} ${isDragOver ? styles.dragOver : ""}`}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload size={24} className={styles.uploadIcon} aria-hidden="true" />
                  <div className={styles.uploadText}>Click to upload or drag and drop</div>
                  <div className={styles.uploadHint}>PDF, DOCX, XLSX, PPTX (max 10MB each)</div>
                  <input
                    id="template-file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.pptx"
                    multiple
                    onChange={handleFileChange}
                    className={styles.visuallyHidden}
                  />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className={styles.uploadedFilesList}>
                    {uploadedFiles.map(({ file, id, status, error, parsedData }) => (
                      <div key={id} className={styles.uploadedFileItem}>
                        <div className={styles.fileIconWrapper}>
                          {status === "parsing" ? (
                            <Loader2 size={18} className={`${styles.fileIcon} ${styles.spinningIcon}`} />
                          ) : status === "error" ? (
                            <AlertCircle size={18} className={`${styles.fileIcon} ${styles.errorIcon}`} />
                          ) : status === "parsed" ? (
                            <CheckCircle size={18} className={`${styles.fileIcon} ${styles.successIcon}`} />
                          ) : (
                            <FileText size={18} className={styles.fileIcon} />
                          )}
                        </div>
                        <div className={styles.fileDetails}>
                          <div className={styles.fileName} title={file.name}>{file.name}</div>
                          <div className={styles.fileMeta}>
                            {formatFileSize(file.size)}
                            {status === "parsing" && (
                              <span className={styles.parsingStatus}> • Parsing on server...</span>
                            )}
                            {status === "parsed" && parsedData && (
                              <span className={styles.parsedStatus}> • {parsedData.word_count} words</span>
                            )}
                            {status === "error" && error && (
                              <span className={styles.errorStatus}> • {error}</span>
                            )}
                          </div>
                        </div>
                        <button
                          className={styles.removeFileBtn}
                          onClick={() => handleRemoveFile(id)}
                          title={status === "parsing" ? "Cancel parsing and remove" : "Remove file"}
                          aria-label="Remove file"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleContinue}
            disabled={!selectedClientId || !proposalName.trim() || selectedDocuments.size === 0 || uploadedFiles.some((f) => f.status === "parsing")}
          >
            Continue to Wizard →
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
