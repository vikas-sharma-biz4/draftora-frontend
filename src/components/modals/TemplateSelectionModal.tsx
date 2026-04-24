"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Plus, CheckSquare, Square, Upload, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import styles from "./TemplateSelectionModal.module.scss";

import type { Client, ClientDocument } from "@/types/client.types";
import { CLIENTS_STORAGE_KEY } from "@/constants";
import { useProposal } from "@/context/ProposalContext";

interface TemplateSelectionModalProps {
  templateId: string;
  templateName: string;
  onClose: () => void;
  onNewClient: () => void;
}

export default function TemplateSelectionModal({
  templateId,
  templateName,
  onClose,
  onNewClient,
}: TemplateSelectionModalProps): JSX.Element | null {
  const router = useRouter();
  const { updateProposalData, setCurrentStep, setDraftStage, markStepCompleted } = useProposal();
  
  const [mounted, setMounted] = useState<boolean>(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [proposalName, setProposalName] = useState<string>("");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [parsingFiles, setParsingFiles] = useState<Map<string, number>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId);
      if (client) {
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

  function loadClients(): void {
    try {
      const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
      const loadedClients = raw ? (JSON.parse(raw) as Client[]) : [];
      setClients(loadedClients);
    } catch {
      setClients([]);
    }
  }

  function handleClientSelect(clientId: string, clientName: string): void {
    setSelectedClientId(clientId);
    setClientSearchQuery(clientName);
    setShowClientDropdown(false);
  }

  function handleClientSearchChange(value: string): void {
    setClientSearchQuery(value);
    setShowClientDropdown(true);
    if (!value.trim()) {
      setSelectedClientId("");
    }
  }

  function handleClientSearchFocus(): void {
    setShowClientDropdown(true);
  }

  function handleClientSearchBlur(): void {
    setTimeout(() => setShowClientDropdown(false), 200);
  }

  function toggleDocument(docId: string): void {
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
    if (!client) return;

    const parsedDocs = client.documents.filter((d) => d.status === "parsed");
    if (selectedDocuments.size === parsedDocs.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(parsedDocs.map((d) => d.id)));
    }
  }

  function handleFileUpload(): void {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles = Array.from(files);
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    
    // Start parsing simulation for each file
    newFiles.forEach((file) => {
      simulateFileParsing(file);
    });
    
    e.target.value = "";
  }

  function simulateFileParsing(file: File): void {
    const fileId = `${file.name}-${Date.now()}`;
    setParsingFiles((prev) => new Map(prev).set(fileId, 0));
    
    const interval = setInterval(() => {
      setParsingFiles((prev) => {
        const newMap = new Map(prev);
        const currentProgress = newMap.get(fileId) || 0;
        
        if (currentProgress >= 100) {
          clearInterval(interval);
          newMap.delete(fileId);
          toast.success(`${file.name} parsed successfully`);
          return newMap;
        }
        
        newMap.set(fileId, currentProgress + Math.random() * 25);
        return newMap;
      });
    }, 300);
  }

  function handleRemoveFile(index: number): void {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRemoveAllFiles(): void {
    setUploadedFiles([]);
    setParsingFiles(new Map());
    toast.info("All uploaded files removed");
  }

  function handleCancelParsing(fileName: string): void {
    const fileId = `${fileName}-${Date.now()}`;
    setParsingFiles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
    toast.info("Parsing cancelled");
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

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

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    // Build filesMeta from selected documents for persistence
    const selectedDocIds = Array.from(selectedDocuments);
    const selectedDocsMeta = client.documents
      .filter((doc) => selectedDocIds.includes(doc.id))
      .map((doc) => ({
        name: doc.name,
        size: typeof doc.size === "number" ? doc.size : Number(doc.size) || 0,
        type: doc.fileType ? String(doc.fileType) : "application/pdf",
      }));

    updateProposalData({
      title: proposalName,
      clientName: client.name,
      clientId: selectedClientId,
      templateId,
      templateType: "predefined",
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
            <h2 className={styles.modalTitle}>Create Proposal from Template</h2>
            <p className={styles.modalSubtitle}>
              Using <strong>{templateName}</strong> template
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.section}>
            <label className={styles.label}>Client Name</label>
            {clients.length === 0 ? (
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
                      <div
                        key={client.id}
                        className={`${styles.clientOption} ${selectedClientId === client.id ? styles.selected : ""}`}
                        onClick={() => handleClientSelect(client.id, client.name)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={styles.clientOptionMain}>
                          <span className={styles.clientOptionName}>{client.name}</span>
                          <span className={styles.clientOptionIndustry}>{client.industry}</span>
                        </div>
                        <div className={styles.clientOptionMeta}>
                          {client.documents.length} docs • {client.proposals.length} proposals
                        </div>
                      </div>
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

          {selectedClient && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <label className={styles.label}>Knowledge Base Selection</label>
                <button className={styles.toggleAllBtn} onClick={toggleAllDocuments}>
                  {selectedDocuments.size === selectedClient.documents.filter((d) => d.status === "parsed").length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              <p className={styles.hint}>
                Choose which documents to include as context for this proposal
              </p>

              <div className={styles.documentList}>
                {selectedClient.documents.filter((d) => d.status === "parsed").length === 0 ? (
                  <div className={styles.noDocuments}>
                    No parsed documents available for this client.
                  </div>
                ) : (
                  selectedClient.documents
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
                          <div className={styles.documentName}>{doc.name}</div>
                          <div className={styles.documentMeta}>
                            {doc.size} • {doc.date}
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
                
                <div className={styles.uploadZone} onClick={handleFileUpload}>
                  <Upload size={24} className={styles.uploadIcon} />
                  <div className={styles.uploadText}>Click to upload documents</div>
                  <div className={styles.uploadHint}>PDF, DOCX, XLSX, PPTX (max 10MB each)</div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className={styles.uploadedFilesList}>
                    {uploadedFiles.map((file, index) => {
                      const fileId = `${file.name}-${Date.now()}`;
                      const progress = parsingFiles.get(fileId) || 0;
                      const isParsing = parsingFiles.has(fileId);

                      return (
                        <div key={index} className={styles.uploadedFileItem}>
                          <div className={styles.fileIconWrapper}>
                            {isParsing ? (
                              <Loader2 size={18} className={styles.spinningIcon} />
                            ) : (
                              <FileText size={18} className={styles.fileIcon} />
                            )}
                          </div>
                          <div className={styles.fileDetails}>
                            <div className={styles.fileName}>{file.name}</div>
                            <div className={styles.fileMeta}>
                              {formatFileSize(file.size)}
                              {isParsing && (
                                <span className={styles.parsingStatus}>
                                  • Parsing {Math.round(progress)}%
                                </span>
                              )}
                            </div>
                            {isParsing && (
                              <div className={styles.progressBar}>
                                <div 
                                  className={styles.progressFill} 
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                          {isParsing ? (
                            <button
                              className={styles.cancelBtn}
                              onClick={() => handleCancelParsing(file.name)}
                              title="Cancel parsing"
                            >
                              <X size={16} />
                            </button>
                          ) : (
                            <button
                              className={styles.removeFileBtn}
                              onClick={() => handleRemoveFile(index)}
                              title="Remove file"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.pptx"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
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
            disabled={!selectedClientId || !proposalName.trim() || selectedDocuments.size === 0}
          >
            Continue to Wizard →
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
