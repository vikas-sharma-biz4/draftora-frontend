"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Plus, CheckSquare, Square, Upload, FileText, Loader2, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";

import styles from "../TemplateSelectionModal.module.scss";
import Button from "@/components/common/Button";
import { Input, Select, Textarea } from "@/components/common/Input";
import FormField from "@/components/common/FormField";

import { useClients } from "@/hooks/useClients";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { useModalHistory } from "@/hooks/useModalHistory";
import type { ClientWithDocuments } from "@/services/client.service";
import { PROPOSAL_TEMPLATES, SCRATCH_TEMPLATE_DEFAULT_SECTIONS, SECTION_DISPLAY_NAMES, INDUSTRIES } from "@/constants";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import {
  useWizardActions,
  useProposalTitle,
  useClientName,
  useClientId,
  useProposalDescription,
  useSelectedSections,
  useSectionDisplayNames,
  useTone,
  useLengthPreference,
  useLanguage,
  useAiModel,
  useTemplateId,
  useTemplateType,
} from "@/store/features/wizard/proposalWizardSlice";
import { parseFiles } from "@/services/upload.service";
import type { ParsedFileResult } from "@/services/upload.service";
import type { NewClientFormData } from "@/interfaces/clientInterfaces";
import { formatDate } from "@/utils/dateUtils";

interface TemplateSelectionModalProps {
  templateId?: string | null;
  templateName?: string;
  onClose: () => void;
  onNewClient?: () => void;
  initialClients?: ClientWithDocuments[];
  isScratch?: boolean;
  newClientData?: {
    client: { id: number; name: string };
    notes: string;
    uploadedFiles: File[];
  };
  enableTemplateSelection?: boolean;
  initialView?: ModalView;
}

type ModalView = "template_selection" | "new_client";

export default function TemplateSelectionModal({
  templateId,
  templateName,
  onClose,
  onNewClient,
  initialClients,
  isScratch = false,
  newClientData,
  enableTemplateSelection = false,
  initialView = "template_selection",
}: TemplateSelectionModalProps): JSX.Element | null {
  const router = useRouter();
  const { updateProposalData, setCurrentStep, setShouldStartBackgroundFetch, prefetchRecommendations } = useWizardActions();

  // Use granular selectors for minimal re-renders
  const title = useProposalTitle();
  const clientName = useClientName();
  const clientId = useClientId();
  const description = useProposalDescription();
  const selectedSections = useSelectedSections();
  const sectionDisplayNames = useSectionDisplayNames();
  const tone = useTone();
  const lengthPreference = useLengthPreference();
  const language = useLanguage();
  const aiModel = useAiModel();
  const templateIdFromStore = useTemplateId();
  const templateTypeFromStore = useTemplateType();

  // Reconstruct proposalData object for backward compatibility with existing code
  const proposalData = {
    title,
    clientName,
    clientId,
    description,
    selectedSections,
    sectionDisplayNames,
    tone,
    lengthPreference,
    language,
    aiModel,
    templateId: templateIdFromStore,
    templateType: templateTypeFromStore,
    files: [],
    filesMeta: [],
    selectedDocumentIds: [],
    customSections: [],
    contextualInstructions: "",
    webReferences: [],
  } as any;

  const draftStage = useDraftSessionStore(state => state.draftStage);
  const setDraftStage = useDraftSessionStore(state => state.setDraftStage);
  const setCurrentDraftId = useDraftSessionStore(state => state.setCurrentDraftId);

  const { clients: storeClients, isLoading: storeLoading } = useClients({ autoFetch: initialClients === undefined });
  const uploadDocumentToStore = useClientStore(state => state.uploadDocument);

  const [mounted, setMounted] = useState<boolean>(false);
  const clients = initialClients ?? storeClients;
  const loading = initialClients === undefined ? storeLoading : false;
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [proposalName, setProposalName] = useState<string>("");
  const [proposalDescription, setProposalDescription] = useState<string>("");
  const [initialContextNotes, setInitialContextNotes] = useState<string>("");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [selectedTemplateIdState, setSelectedTemplateIdState] = useState<string | null>(templateId ?? null);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<
    { file: File; id: string; status: "pending" | "parsing" | "parsed" | "error"; error?: string; parsedData?: ParsedFileResult }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processedFilesRef = useRef<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [modalView, setModalView] = useState<ModalView>(initialView);
  const [newClientFormData, setNewClientFormData] = useState<NewClientFormData>({
    clientName: "",
    industry: "",
    pipelineStage: "Discovery",
    primaryContactName: "",
    primaryContactEmail: "",
    notes: "",
  });
  const [isCreatingClient, setIsCreatingClient] = useState<boolean>(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Enable browser back button to close modal
  useModalHistory({ isOpen: true, onClose, modalId: 'template-selection-modal' });


  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId);
      if (client && client.documents) {
        const allDocIds = new Set(client.documents.filter((d) => d.status === "parsed").map((d) => d.id));
        setSelectedDocuments(allDocIds);
      }
    }
  }, [selectedClientId, clients]);

  // Handle new client data from NewClientModal
  useEffect(() => {
    if (newClientData) {
      // Auto-select the newly created client
      setSelectedClientId(newClientData.client.id);
      // Auto-fill the client name in search input
      setClientSearchQuery(newClientData.client.name);
      // Set the initial context notes
      setInitialContextNotes(newClientData.notes);
      // If template selection is enabled, clear the templateId to allow user to select any template
      if (enableTemplateSelection) {
        setSelectedTemplateIdState(null);
      }
      // Note: Files uploaded in NewClientModal are already uploaded to the client
      // They will appear in the Knowledge Base section automatically when the client is selected
      // We do NOT re-process or re-upload them here to avoid duplicates
    }
  }, [newClientData, enableTemplateSelection]);

  // Fix client auto-selection timing - wait for clients list to be updated
  useEffect(() => {
    if (newClientData && clients.length > 0) {
      const clientExists = clients.find((c) => c.id === newClientData.client.id);
      if (clientExists) {
        setSelectedClientId(newClientData.client.id);
      }
    }
  }, [newClientData, clients]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".xlsx", ".pptx"];
  const ACCEPTED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  /**
   * Validates file extension and size against proposal upload rules.
   * Accepted: PDF, DOCX, TXT, PNG, JPG, JPEG, XLSX, PPTX â‰¤ 10 MB. Emits toast on rejection.
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
    setTimeout(() => setShowClientDropdown(false), 300);
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

  // Native backup listener â€” catches events that React's synthetic system misses
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
      await saveParsedDocumentToClient(file, fileId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backend connection failed";
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: message } : f))
      );
      toast.error(`Backend error parsing "${file.name}"`);
    }
  }

  async function saveParsedDocumentToClient(file: File, fileId: string, result: ParsedFileResult): Promise<void> {
    if (!selectedClientId) {
      logger.info("No client selected, keeping parsed file in uploaded list for later use");
      // Keep the file as parsed but don't upload to client yet
      // The user can upload it later or use it directly in proposal generation
      return;
    }

    try {
      const uploadResult = await uploadDocumentToStore(selectedClientId, file);

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
      logger.error("Failed to upload document:", error);
      const errorMessage = error instanceof Error ? error.message : "Backend connection failed";
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: errorMessage } : f))
      );
      toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
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

    const shouldShowTemplateSelector = enableTemplateSelection || showTemplateSelector || (selectedClientId && !templateId && !isScratch);
    if (shouldShowTemplateSelector && !selectedTemplateIdState) {
      toast.error("Please select a template");
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
        size: doc.sizeBytes,
        type: doc.fileType ? `application/${doc.fileType}` : "application/pdf",
      }));

    const finalTemplateId = (enableTemplateSelection || showTemplateSelector) ? selectedTemplateIdState : templateId;
    const template = finalTemplateId ? PROPOSAL_TEMPLATES.find((t) => t.id === finalTemplateId) : null;

    // Build section display names for scratch template
    const scratchSectionDisplayNames: Record<string, string> = {};
    if (isScratch) {
      SCRATCH_TEMPLATE_DEFAULT_SECTIONS.forEach((key) => {
        scratchSectionDisplayNames[key] = SECTION_DISPLAY_NAMES[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      });
    }

    updateProposalData({
      title: proposalName,
      clientName: client.name,
      description: initialContextNotes ? `${initialContextNotes}\n\n${proposalDescription}` : proposalDescription,
      clientId: selectedClientId,
      templateId: isScratch ? null : finalTemplateId ?? null,
      templateType: isScratch ? "scratch" : (template?.templateType ?? "predefined"),
      selectedSections,
      sectionDisplayNames: isScratch ? scratchSectionDisplayNames : {},
      selectedDocumentIds: selectedDocIds,
      filesMeta: selectedDocsMeta,
    });

    setDraftStage("wizard_in_progress");
    setCurrentStep(4);
    setShouldStartBackgroundFetch(true);
    router.push("/parameters");
    onClose();
  }

  function handleNewClientClick(): void {
    setModalView("new_client");
  }

  function handleBackToTemplateSelection(): void {
    setModalView("template_selection");
    setNewClientFormData({
      clientName: "",
      industry: "",
      pipelineStage: "Discovery",
      primaryContactName: "",
      primaryContactEmail: "",
      notes: "",
    });
  }

  function handleNewClientInputChange(field: keyof NewClientFormData, value: string): void {
    setNewClientFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateClient(): Promise<void> {
    if (!newClientFormData.clientName.trim()) {
      toast.error("Client name is required");
      return;
    }

    if (!newClientFormData.industry) {
      toast.error("Please select an industry");
      return;
    }

    const isDuplicate = clients.some(
      (client) => client.name.toLowerCase().trim() === newClientFormData.clientName.toLowerCase().trim()
    );
    if (isDuplicate) {
      toast.error("A client with this name already exists");
      return;
    }

    const stillParsing = uploadedFiles.some((f) => f.status === "parsing");
    if (stillParsing) {
      toast.error("Please wait for all files to finish parsing");
      return;
    }

    setIsCreatingClient(true);

    try {
      const createClientInStore = useClientStore.getState().createClient;
      const newClient = await createClientInStore({
        name: newClientFormData.clientName,
        industry: newClientFormData.industry,
        notes: newClientFormData.notes || undefined,
      });

      if (uploadedFiles.length > 0) {
        for (const uploaded of uploadedFiles) {
          try {
            await uploadDocumentToStore(newClient.id, uploaded.file);
          } catch (error) {
            logger.error(`Failed to upload ${uploaded.file.name}:`, error);
            toast.error(`Failed to upload ${uploaded.file.name}`);
          }
        }
      }

      toast.success(`Client "${newClientFormData.clientName}" created successfully`);

      // Client is automatically added to store by createClient
      setSelectedClientId(newClient.id);
      setClientSearchQuery(newClient.name);
      setInitialContextNotes(newClientFormData.notes || "");
      setSelectedTemplateIdState(null);
      setUploadedFiles([]);
      setShowTemplateSelector(true); // Show template selector after creating client
      setModalView("template_selection");
      setNewClientFormData({
        clientName: "",
        industry: "",
        pipelineStage: "Discovery",
        primaryContactName: "",
        primaryContactEmail: "",
        notes: "",
      });
    } catch (error) {
      logger.error("Failed to create client:", error);
      toast.error("Failed to create client");
    } finally {
      setIsCreatingClient(false);
    }
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {modalView === "new_client" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToTemplateSelection}
                aria-label="Back to template selection"
                className={styles.backBtn}
              >
                <ArrowLeft size={16} />
                Back
              </Button>
            )}
            <div>
              <h2 className={styles.modalTitle}>
                {modalView === "new_client"
                  ? "Add New Client"
                  : isScratch ? "Start From Scratch" : "Create Proposal from Template"}
              </h2>
              <p className={styles.modalSubtitle}>
                {modalView === "new_client"
                  ? "Enter details to provision a new client workspace."
                  : isScratch
                    ? "Build a proposal without a predefined template"
                    : <>Using <strong>{templateName}</strong> template</>}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            iconOnly
            onClick={onClose}
            aria-label="Close"
            className={styles.closeBtn}
          >
            <X size={20} />
          </Button>
        </div>

        <div className={styles.modalBody}>
          {modalView === "new_client" ? (
            <>
              <div className={styles.section}>
                <FormField label="Client Name">
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type="text"
                      placeholder="e.g. Acme Corporation"
                      value={newClientFormData.clientName}
                      onChange={(e) => handleNewClientInputChange("clientName", e.target.value)}
                    />
                  )}
                </FormField>

                <FormField label="Industry">
                  {(fieldProps) => (
                    <Select
                      {...fieldProps}
                      value={newClientFormData.industry}
                      onChange={(e) => handleNewClientInputChange("industry", e.target.value)}
                    >
                      <option value="">Select industry...</option>
                      {INDUSTRIES.map((industry) => (
                        <option key={industry} value={industry}>
                          {industry}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  Initial Context & Notes
                  <span className={styles.optional}>Optional</span>
                </h3>

                <FormField label="">
                  {(fieldProps) => (
                    <Textarea
                      {...fieldProps}
                      placeholder="Add any background context, specific requirements, or initial observations..."
                      value={newClientFormData.notes}
                      onChange={(e) => handleNewClientInputChange("notes", e.target.value)}
                      rows={4}
                    />
                  )}
                </FormField>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Upload Documents</h3>

                <label
                  htmlFor="new-client-file-upload"
                  className={`${styles.uploadZone} ${isDragOver ? styles.dragOver : ""}`}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload size={24} className={styles.uploadIcon} aria-hidden="true" />
                  <div className={styles.uploadText}>
                    Click to upload or drag and drop
                  </div>
                  <div className={styles.uploadHint}>
                    PDF, DOCX, TXT, PNG, JPG, JPEG, XLSX, PPTX (max 10MB each)
                  </div>
                  <input
                    id="new-client-file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
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
                              <span className={styles.parsingStatus}> â€¢ Parsing on server...</span>
                            )}
                            {status === "parsed" && parsedData && (
                              <span className={styles.parsedStatus}> â€¢ {parsedData.word_count} words</span>
                            )}
                            {status === "error" && error && (
                              <span className={styles.errorStatus}> â€¢ {error}</span>
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
            </>
          ) : (
            <>
              {(enableTemplateSelection || showTemplateSelector || (selectedClientId && !templateId && !isScratch)) && (
            <div className={styles.section}>
              <label className={styles.label}>Select a Template</label>
              <div className={styles.templateGrid}>
                {PROPOSAL_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`${styles.templateCard} ${selectedTemplateIdState === template.id ? styles.selected : ""}`}
                    onClick={() => setSelectedTemplateIdState(template.id)}
                  >
                    <div className={styles.templateCardIcon}>{template.icon}</div>
                    <div className={styles.templateCardInfo}>
                      <div className={styles.templateCardTitle}>{template.name}</div>
                      <div className={styles.templateCardDescription}>{template.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.section}>
            <label className={styles.label}>Client Name</label>
            {loading ? (
              <div className={styles.noClients}>
                <p>Loading clients...</p>
              </div>
            ) : clients.length === 0 ? (
              <div className={styles.noClients}>
                <p>No clients found. Create your first client to continue.</p>
                <Button variant="primary" size="sm" onClick={handleNewClientClick}>
                  <Plus size={16} />
                  New Client
                </Button>
              </div>
            ) : (
              <div className={styles.searchWrapper}>
                <div className={styles.searchInputWrapper}>
                  <Input
                    type="text"
                    placeholder="Search for a client..."
                    value={clientSearchQuery}
                    onChange={(e) => handleClientSearchChange(e.target.value)}
                    onFocus={handleClientSearchFocus}
                    onBlur={handleClientSearchBlur}
                    className={styles.searchInput}
                  />
                  <Button variant="secondary" size="sm" onClick={handleNewClientClick} className={styles.newClientBtn}>
                    <Plus size={16} />
                    New Client
                  </Button>
                </div>

                {showClientDropdown && filteredClients.length > 0 && (
                  <div className={styles.clientDropdown}>
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className={`${styles.clientOption} ${selectedClientId === client.id ? styles.selected : ""}`}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          handleClientSelect(client.id, client.name);
                        }}
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

          <FormField label="Proposal Name">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="text"
                placeholder="e.g. Q4 Digital Transformation Initiative"
                value={proposalName}
                onChange={(e) => setProposalName(e.target.value)}
              />
            )}
          </FormField>

          {initialContextNotes && (
            <FormField label="Initial Context & Notes">
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  placeholder="Initial context and notes from client creation..."
                  value={initialContextNotes}
                  onChange={(e) => setInitialContextNotes(e.target.value)}
                  rows={4}
                />
              )}
            </FormField>
          )}

          <FormField label="Project Brief">
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                placeholder="Describe the project scope, client's core challenge, desired outcomes, technical constraints, and any specific requirements..."
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
              />
            )}
          </FormField>

          {selectedClient && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <label className={styles.label}>Knowledge Base Selection</label>
                <Button variant="secondary" size="sm" onClick={toggleAllDocuments} className={styles.toggleAllBtn}>
                  {selectedDocuments.size === (selectedClient.documents?.filter((d) => d.status === "parsed").length || 0)
                    ? "Deselect All"
                    : "Select All"}
                </Button>
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
                            {formatFileSize(doc.sizeBytes)} • {formatDate(doc.createdAt)}
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
                    <Button variant="ghost" size="sm" onClick={handleRemoveAllFiles} className={styles.removeAllBtn}>
                      Remove All
                    </Button>
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
                  <div className={styles.uploadHint}>PDF, DOCX, TXT, PNG, JPG, JPEG, XLSX, PPTX (max 10MB each)</div>
                  <input
                    id="template-file-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
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
                              <span className={styles.parsingStatus}> â€¢ Parsing on server...</span>
                            )}
                            {status === "parsed" && parsedData && (
                              <span className={styles.parsedStatus}> â€¢ {parsedData.word_count} words</span>
                            )}
                            {status === "error" && error && (
                              <span className={styles.errorStatus}> â€¢ {error}</span>
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
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          {modalView === "new_client" ? (
            <>
              <Button variant="secondary" onClick={handleBackToTemplateSelection}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateClient}
                disabled={!newClientFormData.clientName.trim() || !newClientFormData.industry}
                loading={isCreatingClient}
              >
                Create Client
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleContinue}
                disabled={!selectedClientId || !proposalName.trim() || selectedDocuments.size === 0 || uploadedFiles.some((f) => f.status === "parsing")}
              >
                Continue to Wizard
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
