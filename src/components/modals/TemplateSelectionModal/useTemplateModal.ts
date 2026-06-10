"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/utils/toast";
import { logger } from "@/utils/logger";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useClients } from "@/hooks/useClients";
import { useClientStore } from "@/store/features/clients/clientSlice";
import { useModalHistory } from "@/hooks/useModalHistory";
import { getDocumentViewUrl } from "@/services/client.service";
import {
  PROPOSAL_TEMPLATES,
  SCRATCH_TEMPLATE_DEFAULT_SECTIONS,
  SECTION_DISPLAY_NAMES,
} from "@/constants";
import { useDraftSessionStore } from "@/store/features/drafts/draftSessionSlice";
import { useWizardActions, useSelectedSections } from "@/store/features/wizard/proposalWizardSlice";
import { parseFiles } from "@/services/upload.service";
import type { NewClientFormData } from "@/interfaces/clientInterfaces";
import type { ClientWithDocuments } from "@/interfaces/clientInterfaces";
import type { ModalView, TemplateSelectionModalProps, UploadedFile } from "./types";

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

export interface UseTemplateModalReturn {
  // Mount / loading
  mounted: boolean;
  clients: ClientWithDocuments[];
  loading: boolean;

  // Selection state
  selectedClientId: number | null;
  selectedClient: ClientWithDocuments | undefined;
  filteredClients: ClientWithDocuments[];
  selectedDocuments: Set<number>;
  selectedTemplateIdState: string | null;

  // Client search dropdown
  clientSearchQuery: string;
  showClientDropdown: boolean;
  highlightedIndex: number;

  // Form fields
  proposalName: string;
  proposalDescription: string;
  initialContextNotes: string;

  // File upload
  uploadedFiles: UploadedFile[];
  viewingDocId: number | null;

  // View / navigation
  modalView: ModalView;
  showTemplateSelector: boolean;
  isPending: boolean;

  // New-client form
  newClientFormData: NewClientFormData;
  isCreatingClient: boolean;
  newClientOtherIndustry: string;

  // Field setters (passed straight to input onChange)
  setProposalName: (name: string) => void;
  setProposalDescription: (desc: string) => void;
  setInitialContextNotes: (notes: string) => void;
  setSelectedTemplateIdState: (id: string | null) => void;
  setNewClientOtherIndustry: (value: string) => void;

  // File handlers
  processFileList: (files: FileList | null) => void;
  handleRemoveFile: (fileId: string) => void;
  handleRemoveAllFiles: () => void;

  // Client search handlers
  handleClientSelect: (clientId: number, clientName: string) => void;
  handleClientSearchChange: (value: string) => void;
  handleClientSearchFocus: () => void;
  handleClientSearchBlur: () => void;
  handleClientKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  // Document handlers
  toggleDocument: (docId: number) => void;
  toggleAllDocuments: () => void;
  handleViewDocument: (clientId: number, doc: { id: number; s3FileUrl?: string }) => Promise<void>;

  // Submission
  handleContinue: () => Promise<void>;

  // New-client handlers
  handleNewClientClick: () => void;
  handleNewClientInputChange: (field: keyof NewClientFormData, value: string) => void;
  handleCreateClient: () => Promise<void>;
}

export function useTemplateModal({
  templateId,
  onClose,
  initialClients,
  isScratch = false,
  newClientData,
  enableTemplateSelection = false,
  initialView = "template_selection",
}: TemplateSelectionModalProps): UseTemplateModalReturn {
  const router = useRouter();
  const { updateProposalData, setCurrentStep } = useWizardActions();
  const selectedSections = useSelectedSections();

  const setDraftStage = useDraftSessionStore((state) => state.setDraftStage);

  // Store actions — stable Zustand references, safe to select via hook
  const uploadDocument = useClientStore((state) => state.uploadDocument);
  const createClient = useClientStore((state) => state.createClient);

  const { clients: storeClients, isLoading: storeLoading } = useClients({
    autoFetch: initialClients === undefined,
  });

  const clients = initialClients ?? storeClients;
  const loading = initialClients === undefined ? storeLoading : false;

  // ── Core state ────────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [proposalName, setProposalName] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [initialContextNotes, setInitialContextNotes] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [selectedTemplateIdState, setSelectedTemplateIdState] = useState<string | null>(
    templateId ?? null
  );

  // ── Client search ─────────────────────────────────────────────────────────
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // ── File upload ───────────────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);

  // ── View / navigation ─────────────────────────────────────────────────────
  const [modalView, setModalView] = useState<ModalView>(initialView);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [isPending, startTransition] = useTransition();
  const navigationStartedRef = useRef(false);

  // ── New-client form ───────────────────────────────────────────────────────
  const [newClientFormData, setNewClientFormData] = useState<NewClientFormData>({
    clientName: "",
    industry: "",
    pipelineStage: "Discovery",
    primaryContactName: "",
    primaryContactEmail: "",
    notes: "",
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientOtherIndustry, setNewClientOtherIndustry] = useState("");

  // ── Document auto-select ref ──────────────────────────────────────────────
  const initialDocIdsRef = useRef<Set<number>>(new Set());

  // ── Derived (memoised) ────────────────────────────────────────────────────
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())),
    [clients, clientSearchQuery]
  );

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useModalHistory({ isOpen: true, onClose, modalId: "template-selection-modal" });

  // Close modal once navigation has fully committed
  useEffect(() => {
    if (!isPending && navigationStartedRef.current) {
      navigationStartedRef.current = false;
      onClose();
    }
  }, [isPending, onClose]);

  // Auto-select parsed documents when a client is chosen
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId);
      if (client?.documents) {
        const currentDocIds = new Set(
          client.documents.filter((d) => d.status === "parsed").map((d) => d.id)
        );

        if (
          initialDocIdsRef.current.size === 0 ||
          !currentDocIds.isSupersetOf(initialDocIdsRef.current)
        ) {
          setSelectedDocuments(currentDocIds);
          initialDocIdsRef.current = currentDocIds;
        } else {
          const newDocIds = new Set(
            Array.from(currentDocIds).filter((id) => !initialDocIdsRef.current.has(id))
          );
          if (newDocIds.size > 0) {
            setSelectedDocuments((prev) => {
              const next = new Set(prev);
              newDocIds.forEach((id) => next.add(id));
              return next;
            });
            initialDocIdsRef.current = currentDocIds;
          }
        }
      }
    } else {
      initialDocIdsRef.current = new Set();
    }
  }, [selectedClientId, clients]);

  // Handle client data coming from NewClientModal (parent flow)
  useEffect(() => {
    if (newClientData) {
      setSelectedClientId(newClientData.client.id);
      setClientSearchQuery(newClientData.client.name);
      setInitialContextNotes(newClientData.notes);
      if (enableTemplateSelection) {
        setSelectedTemplateIdState(null);
      }
    }
  }, [newClientData, enableTemplateSelection]);

  // Wait for the clients list to update before confirming auto-selection
  useEffect(() => {
    if (newClientData && clients.length > 0) {
      const exists = clients.find((c) => c.id === newClientData.client.id);
      if (exists) setSelectedClientId(newClientData.client.id);
    }
  }, [newClientData, clients]);

  useBodyScrollLock();

  // ── File handling ─────────────────────────────────────────────────────────

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
      await saveParsedDocumentToClient(file, fileId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backend connection failed";
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: message } : f))
      );
      toast.error(`Backend error parsing "${file.name}"`);
    }
  }

  // `_parsedData` is accepted for API symmetry with startRealParsing but is not used here
  async function saveParsedDocumentToClient(file: File, fileId: string): Promise<void> {
    if (!selectedClientId) {
      logger.info("No client selected — parsed file queued in upload list");
      return;
    }

    try {
      const uploadResult = await uploadDocument(selectedClientId, file);
      if (!uploadResult) throw new Error("uploadDocument returned undefined");

      setSelectedDocuments((prev) => {
        const next = new Set(prev);
        next.add(uploadResult.id);
        return next;
      });
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      logger.error("Failed to upload document:", error);
      const message = error instanceof Error ? error.message : "Backend connection failed";
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: message } : f))
      );
      toast.error(`Failed to upload ${file.name}: ${message}`);
    }
  }

  function handleRemoveFile(fileId: string): void {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  function handleRemoveAllFiles(): void {
    setUploadedFiles([]);
    toast.info("All uploaded files removed");
  }

  // ── Client search ─────────────────────────────────────────────────────────

  function handleClientSelect(clientId: number, clientName: string): void {
    setSelectedClientId(clientId);
    setClientSearchQuery(clientName);
    setShowClientDropdown(false);
  }

  function handleClientSearchChange(value: string): void {
    setClientSearchQuery(value);
    setShowClientDropdown(true);
    setHighlightedIndex(-1);
    if (!value.trim()) setSelectedClientId(null);
  }

  function handleClientSearchFocus(): void {
    setShowClientDropdown(true);
  }

  function handleClientSearchBlur(): void {
    // 300 ms delay so onPointerDown on a dropdown item fires before blur closes it
    setTimeout(() => {
      setShowClientDropdown(false);
      setHighlightedIndex(-1);
    }, 300);
  }

  function handleClientKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!showClientDropdown || filteredClients.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filteredClients.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
          const client = filteredClients[highlightedIndex];
          handleClientSelect(client.id, client.name);
          setHighlightedIndex(-1);
        }
        break;
      case "Escape":
        setShowClientDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  }

  // ── Document selection ────────────────────────────────────────────────────

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
    if (!client?.documents) return;

    const parsedDocs = client.documents.filter((d) => d.status === "parsed");
    if (selectedDocuments.size === parsedDocs.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(parsedDocs.map((d) => d.id)));
    }
  }

  async function handleViewDocument(
    clientId: number,
    doc: { id: number; s3FileUrl?: string }
  ): Promise<void> {
    if (!doc.s3FileUrl) return;
    try {
      setViewingDocId(doc.id);
      const viewUrl = await getDocumentViewUrl(clientId, doc.id);
      window.open(viewUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open document. Please try again.");
    } finally {
      setViewingDocId(null);
    }
  }

  // ── Form submission ───────────────────────────────────────────────────────

  async function handleContinue(): Promise<void> {
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }

    if (!proposalName.trim()) {
      toast.error("Please enter a proposal name");
      return;
    }

    const shouldShowTemplateSelector =
      enableTemplateSelection ||
      showTemplateSelector ||
      (selectedClientId && !templateId && !isScratch);

    if (shouldShowTemplateSelector && !selectedTemplateIdState) {
      toast.error("Please select a template");
      return;
    }

    if (selectedDocuments.size === 0) {
      toast.error("Please select at least one document");
      return;
    }

    if (uploadedFiles.some((f) => f.status === "parsing")) {
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

    const finalTemplateId =
      enableTemplateSelection || showTemplateSelector ? selectedTemplateIdState : templateId;
    const template = finalTemplateId
      ? PROPOSAL_TEMPLATES.find((t) => t.id === finalTemplateId)
      : null;

    const scratchSectionDisplayNames: Record<string, string> = {};
    if (isScratch) {
      SCRATCH_TEMPLATE_DEFAULT_SECTIONS.forEach((key) => {
        scratchSectionDisplayNames[key] =
          SECTION_DISPLAY_NAMES[key] ||
          key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      });
    }

    updateProposalData({
      title: proposalName,
      clientName: client.name,
      description: initialContextNotes
        ? `${initialContextNotes}\n\n${proposalDescription}`
        : proposalDescription,
      clientId: selectedClientId,
      templateId: isScratch ? null : (finalTemplateId ?? null),
      templateType: isScratch ? "scratch" : (template?.templateType ?? "predefined"),
      selectedSections: isScratch
        ? [...SCRATCH_TEMPLATE_DEFAULT_SECTIONS]
        : template?.sections
          ? [...template.sections]
          : selectedSections,
      sectionDisplayNames: isScratch ? scratchSectionDisplayNames : {},
      selectedDocumentIds: selectedDocIds,
      filesMeta: selectedDocsMeta,
    });

    setDraftStage("wizard_in_progress");
    setCurrentStep(1);

    navigationStartedRef.current = true;
    startTransition(() => {
      router.push("/parameters");
    });
  }

  // ── New-client handlers ───────────────────────────────────────────────────

  function handleNewClientClick(): void {
    setModalView("new_client");
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
    if (newClientFormData.industry === "Other" && !newClientOtherIndustry.trim()) {
      toast.error("Please specify your industry");
      return;
    }
    if (
      clients.some(
        (c) => c.name.toLowerCase().trim() === newClientFormData.clientName.toLowerCase().trim()
      )
    ) {
      toast.error("A client with this name already exists");
      return;
    }
    if (uploadedFiles.some((f) => f.status === "parsing")) {
      toast.error("Please wait for all files to finish parsing");
      return;
    }

    setIsCreatingClient(true);
    try {
      const resolvedIndustry =
        newClientFormData.industry === "Other"
          ? newClientOtherIndustry.trim()
          : newClientFormData.industry;

      const newClient = await createClient({
        name: newClientFormData.clientName,
        industry: resolvedIndustry,
        notes: newClientFormData.notes || undefined,
      });

      for (const uploaded of uploadedFiles) {
        try {
          await uploadDocument(newClient.id, uploaded.file);
        } catch (err) {
          logger.error(`Failed to upload ${uploaded.file.name}:`, err);
          toast.error(`Failed to upload ${uploaded.file.name}`);
        }
      }

      toast.success(`Client "${newClientFormData.clientName}" created`);

      setSelectedClientId(newClient.id);
      setClientSearchQuery(newClient.name);
      setInitialContextNotes(newClientFormData.notes || "");
      setUploadedFiles([]);

      if (!templateId) {
        setSelectedTemplateIdState(null);
        setShowTemplateSelector(true);
      }

      setModalView("template_selection");
      setNewClientOtherIndustry("");
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

  return {
    mounted,
    clients,
    loading,
    selectedClientId,
    selectedClient,
    filteredClients,
    selectedDocuments,
    selectedTemplateIdState,
    clientSearchQuery,
    showClientDropdown,
    highlightedIndex,
    proposalName,
    proposalDescription,
    initialContextNotes,
    uploadedFiles,
    viewingDocId,
    modalView,
    showTemplateSelector,
    isPending,
    newClientFormData,
    isCreatingClient,
    newClientOtherIndustry,
    setProposalName,
    setProposalDescription,
    setInitialContextNotes,
    setSelectedTemplateIdState,
    setNewClientOtherIndustry,
    processFileList,
    handleRemoveFile,
    handleRemoveAllFiles,
    handleClientSelect,
    handleClientSearchChange,
    handleClientSearchFocus,
    handleClientSearchBlur,
    handleClientKeyDown,
    toggleDocument,
    toggleAllDocuments,
    handleViewDocument,
    handleContinue,
    handleNewClientClick,
    handleNewClientInputChange,
    handleCreateClient,
  };
}
