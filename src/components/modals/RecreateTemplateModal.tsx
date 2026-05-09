"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  CheckSquare,
  Square,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FileSearch,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import styles from "./TemplateSelectionModal.module.scss";

import {
  listClientsWithDocuments,
  invalidateClientsCache,
  uploadDocument,
  type ClientWithDocuments,
} from "@/services/clientApi";
import { INDUSTRIES } from "@/constants";
import type { NewClientFormData } from "@/interfaces/clientInterfaces";
import { useClientStore } from "@/redux/features/clientStore";
import { useProposal } from "@/context/ProposalContext";
import { parseFiles } from "@/services/api";
import type { ParsedFileResult } from "@/services/api";
import {
  parseRecreateDocument,
  type RecreateExtractedSection,
} from "@/services/proposalApi";
import type { OriginalSection } from "@/interfaces/proposalInterfaces";

interface RecreateTemplateModalProps {
  onClose: () => void;
  onNewClient?: () => void;
}

type ModalView = "recreate_template" | "new_client";

interface ContextUploadEntry {
  file: File;
  id: string;
  status: "pending" | "parsing" | "parsed" | "error";
  error?: string;
  parsedData?: ParsedFileResult;
}

export default function RecreateTemplateModal({
  onClose,
  onNewClient,
}: RecreateTemplateModalProps): JSX.Element | null {
  const router = useRouter();
  const { updateProposalData, setCurrentStep, setDraftStage, markStepCompleted } =
    useProposal();

  const [mounted, setMounted] = useState<boolean>(false);
  const [clients, setClients] = useState<ClientWithDocuments[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [proposalName, setProposalName] = useState<string>("");
  const [proposalDescription, setProposalDescription] = useState<string>("");

  // Exact document (structure source)
  const [exactDocument, setExactDocument] = useState<{
    file: File;
    status: "pending" | "parsing" | "parsed" | "error";
    error?: string;
    sections?: RecreateExtractedSection[];
    fullText?: string;
  } | null>(null);
  const exactInputRef = useRef<HTMLInputElement>(null);
  const [exactDragOver, setExactDragOver] = useState<boolean>(false);
  const abortExactRef = useRef<AbortController | null>(null);

  // Context documents (content source)
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [contextUploads, setContextUploads] = useState<ContextUploadEntry[]>([]);
  const contextInputRef = useRef<HTMLInputElement>(null);
  const [contextDragOver, setContextDragOver] = useState<boolean>(false);
  const processedContextRef = useRef<Set<string>>(new Set());

  // Client search
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);

  // Modal view state
  const [modalView, setModalView] = useState<ModalView>("recreate_template");
  const [newClientFormData, setNewClientFormData] = useState<NewClientFormData>({
    clientName: "",
    industry: "",
    pipelineStage: "Discovery",
    primaryContactName: "",
    primaryContactEmail: "",
    notes: "",
  });
  const [isCreatingClient, setIsCreatingClient] = useState<boolean>(false);
  const uploadDocumentToStore = useClientStore(state => state.uploadDocument);

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

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      abortExactRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId);
      if (client?.documents) {
        const allDocIds = new Set(
          client.documents.filter((d) => d.status === "parsed").map((d) => d.id)
        );
        setSelectedDocuments(allDocIds);
      }
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Universal hierarchy builder for any TOC content.
   * Detects parent-child relationships based on numbering patterns:
   * - Numeric: 1., 1.1, 1.1.1
   * - Roman: I., II., III.
   * - Alphabetic: A., B., C. or a., b., c.
   * - Mixed: Any combination
   * - Indentation-based (if available from backend)
   * 
   * Algorithm:
   * 1. Analyze numbering depth (dots, nesting)
   * 2. Track parent context based on level changes
   * 3. Support any document category (technical, legal, business, etc.)
   */
  function buildSectionHierarchy(
    sections: RecreateExtractedSection[]
  ): RecreateExtractedSection[] {
    if (sections.length === 0) return [];

    const result: RecreateExtractedSection[] = [];
    const parentStack: Array<{ section: RecreateExtractedSection; level: number }> = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const title = section.title.trim();

      // Detect numbering level from various patterns
      const level = detectSectionLevel(title, i, sections);
      
      // Find appropriate parent based on level
      let parentId: string | undefined = undefined;
      
      // Pop stack until we find a parent at lower level
      while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
        parentStack.pop();
      }
      
      // Current top of stack is the parent (if exists)
      if (parentStack.length > 0) {
        parentId = parentStack[parentStack.length - 1].section.id;
      }

      const hierarchicalSection: RecreateExtractedSection = {
        ...section,
        level,
        parentId,
      };

      result.push(hierarchicalSection);
      
      // Add to stack as potential parent for future sections
      parentStack.push({ section: hierarchicalSection, level });
    }

    return result;
  }

  /**
   * Universal section level detector.
   * Simple rule: Analyze numbering depth and context.
   */
  function detectSectionLevel(
    title: string, 
    index: number, 
    allSections: RecreateExtractedSection[]
  ): number {
    // Rule 1: Multi-level numbering (1.1, 1.1.1, 2.3.4)
    const multiLevel = title.match(/^(\d+(?:\.\d+)+)[\.\)]\s+/);
    if (multiLevel) {
      const dots = (multiLevel[1].match(/\./g) || []).length;
      return dots + 1; // 1.1 → level 2, 1.1.1 → level 3
    }

    // Rule 2: Simple single number (1., 2., 3., etc.)
    const singleNumber = title.match(/^(\d+)[\.\)]\s+/);
    if (singleNumber) {
      const num = parseInt(singleNumber[1], 10);
      
      // Look back up to 20 sections to find a non-numbered parent
      const lookBackLimit = Math.min(index, 20);
      for (let i = 1; i <= lookBackLimit; i++) {
        const prevIndex = index - i;
        const prevTitle = allSections[prevIndex].title.trim();
        
        // Check if previous section has NO numbering at start
        const hasNumbering = /^(\d+|[IVXLCDM]+|[A-Za-z])[\.\)]\s+/.test(prevTitle);
        
        if (!hasNumbering) {
          // Found a non-numbered section - this is likely the parent
          // Current section is a child (level 2)
          return 2;
        }
        
        // If we hit a multi-level number (1.1, 2.3), stop searching
        if (/^\d+\.\d+/.test(prevTitle)) {
          break;
        }
      }
      
      // No parent found - top level
      return 1;
    }

    // Rule 3: Roman numerals (I., II., III.)
    if (/^([IVXLCDM]+)[\.\)]\s+/i.test(title)) {
      return 1;
    }

    // Rule 4: Alphabetic (A., B., a., b.)
    if (/^([A-Za-z])[\.\)]\s+/.test(title)) {
      // Check if previous section is numbered
      if (index > 0 && /^\d+[\.\)]\s+/.test(allSections[index - 1].title.trim())) {
        return 2; // Subsection under number
      }
      return 1;
    }

    // Rule 5: Bullets (•, -, *, →)
    if (/^[•\-\*→]\s+/.test(title)) {
      return 2;
    }

    // Rule 6: Parenthesized numbers (1), (2)
    if (/^\(\d+\)\s+/.test(title)) {
      return 2;
    }

    // Rule 7: Non-numbered section - check if it's a parent
    // If next section starts with "1." it's likely a parent
    if (index < allSections.length - 1) {
      const nextTitle = allSections[index + 1].title.trim();
      if (/^1[\.\)]\s+/.test(nextTitle)) {
        return 1; // Parent of numbered list
      }
    }

    // Default: top-level
    return 1;
  }

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

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  async function loadClients(): Promise<void> {
    try {
      setLoading(true);
      const clientsWithDocs = await listClientsWithDocuments();
      setClients(clientsWithDocs);
    } catch {
      toast.error("Failed to load clients");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  // ── Client selection ───────────────────────────────────────────────────────

  function handleClientSelect(clientId: number, clientName: string): void {
    setSelectedClientId(clientId);
    setClientSearchQuery(clientName);
    setShowClientDropdown(false);
  }

  function handleClientSearchChange(value: string): void {
    setClientSearchQuery(value);
    setShowClientDropdown(true);
    if (!value.trim()) setSelectedClientId(null);
  }

  // ── Exact document (structure source) ─────────────────────────────────────

  async function handleExactFileSelected(file: File): Promise<void> {
    if (!isValidFile(file)) return;

    abortExactRef.current?.abort();
    const controller = new AbortController();
    abortExactRef.current = controller;

    setExactDocument({ file, status: "parsing" });

    try {
      const result = await parseRecreateDocument(file, controller.signal);

      if (result.sections.length === 0) {
        setExactDocument({ file, status: "error", error: "No sections found in document." });
        toast.error("No sections could be detected in the document");
        return;
      }

      // Filter out static sections that are always included and not AI-generated
      const STATIC_SECTIONS_TO_EXCLUDE = [
        "Trusted Advisors",
        "Our Trusted Clients",
        "Why Choose Us?",
        "Brain Behind Innovative Development",
      ];

      const filteredSections = result.sections.filter((section) => {
        const normalizedTitle = section.title.trim();
        return !STATIC_SECTIONS_TO_EXCLUDE.some(
          (staticTitle) => normalizedTitle.toLowerCase() === staticTitle.toLowerCase()
        );
      });

      const removedCount = result.sections.length - filteredSections.length;

      // Build hierarchical structure from filtered sections
      const hierarchicalSections = buildSectionHierarchy(filteredSections);

      setExactDocument({
        file,
        status: "parsed",
        sections: hierarchicalSections,
        fullText: result.fullText,
      });
      
      const message = removedCount > 0
        ? `"${file.name}" parsed — ${filteredSections.length} dynamic section(s) extracted (${removedCount} static section(s) excluded)`
        : `"${file.name}" parsed — ${filteredSections.length} section(s) extracted`;
      
      toast.success(message);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Parse failed";
      setExactDocument({ file, status: "error", error: message });
      toast.error(`Failed to parse "${file.name}"`);
    }
  }

  function handleExactInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) handleExactFileSelected(file);
    e.target.value = "";
  }

  function handleExactDrop(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    setExactDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleExactFileSelected(file);
  }

  function handleRemoveExactDocument(): void {
    abortExactRef.current?.abort();
    setExactDocument(null);
  }

  // ── Context documents (content source) ────────────────────────────────────

  function processContextFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;
    const valid = Array.from(files).filter(isValidFile);
    if (valid.length === 0) return;

    const entries: ContextUploadEntry[] = valid.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: "pending" as const,
    }));

    setContextUploads((prev) => [...prev, ...entries]);
    entries.forEach((e) => startContextParsing(e.file, e.id));
  }

  async function startContextParsing(file: File, fileId: string): Promise<void> {
    setContextUploads((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "parsing" } : f))
    );

    try {
      const response = await parseFiles([file]);

      if (response.errors.length > 0) {
        const errMsg = response.errors[0].error;
        setContextUploads((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: errMsg } : f))
        );
        toast.error(`Failed to parse "${file.name}": ${errMsg}`);
        return;
      }

      const result = response.results[0];
      setContextUploads((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: "parsed", parsedData: result } : f
        )
      );

      // Save to client KB and auto-select
      if (selectedClientId) {
        try {
          const uploaded = await uploadDocument(selectedClientId, file);
          invalidateClientsCache();
          await loadClients();
          setSelectedDocuments((prev) => new Set(Array.from(prev).concat(uploaded.id)));
          setContextUploads((prev) => prev.filter((f) => f.id !== fileId));
          toast.success(`"${file.name}" added to context documents`);
        } catch {
          toast.success(`"${file.name}" parsed — ${result.word_count} words`);
        }
      } else {
        toast.success(`"${file.name}" parsed — ${result.word_count} words`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Parse failed";
      setContextUploads((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: "error", error: message } : f))
      );
      toast.error(`Failed to parse "${file.name}"`);
    }
  }

  function handleContextInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    processContextFiles(e.target.files);
    e.target.value = "";
  }

  function handleContextDrop(e: React.DragEvent<HTMLLabelElement>): void {
    e.preventDefault();
    setContextDragOver(false);
    processContextFiles(e.dataTransfer.files);
  }

  // Native fallback listener for context input
  useEffect(() => {
    const input = contextInputRef.current;
    if (!input) return;

    const onNativeChange = (evt: Event) => {
      const target = evt.target as HTMLInputElement;
      const files = target.files;
      if (!files || files.length === 0) return;
      const fingerprint = Array.from(files)
        .map((f) => `${f.name}-${f.size}-${f.lastModified}`)
        .join("|");
      if (processedContextRef.current.has(fingerprint)) return;
      processedContextRef.current.add(fingerprint);
      setTimeout(() => processedContextRef.current.delete(fingerprint), 150);
      processContextFiles(files);
      target.value = "";
    };

    input.addEventListener("change", onNativeChange);
    return () => input.removeEventListener("change", onNativeChange);
  }, []);

  function toggleDocument(docId: number): void {
    setSelectedDocuments((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  function toggleAllDocuments(): void {
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client?.documents) return;
    const parsed = client.documents.filter((d) => d.status === "parsed");
    if (selectedDocuments.size === parsed.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(parsed.map((d) => d.id)));
    }
  }

  // ── Continue ───────────────────────────────────────────────────────────────

  function handleContinue(): void {
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }
    if (!proposalName.trim()) {
      toast.error("Please enter a proposal name");
      return;
    }
    if (!exactDocument) {
      toast.error("Please upload an exact document");
      return;
    }
    if (exactDocument.status === "parsing") {
      toast.error("Please wait for the exact document to finish parsing");
      return;
    }
    if (exactDocument.status !== "parsed") {
      toast.error("Exact document parsing failed. Please re-upload it.");
      return;
    }

    const stillParsing = contextUploads.some((f) => f.status === "parsing");
    if (stillParsing) {
      toast.error("Please wait for all context documents to finish parsing");
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    const sections = exactDocument.sections ?? [];

    // Build OriginalSection[] from parsed sections (preserving hierarchy)
    const originalSections: OriginalSection[] = sections.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      order: s.order,
      type: (s.type as "text" | "table" | "mixed") ?? "text",
      level: s.level,
      parentId: s.parentId,
    }));

    // Build originalSectionContents map (key -> content) for rewrite prompts
    const originalSectionContents: Record<string, string> = {};
    sections.forEach((s) => {
      originalSectionContents[s.id] = s.content;
    });

    // Build contextualInstructions from exact doc full text
    const contextualInstructions = exactDocument.fullText
      ? `[SOURCE DOCUMENT — ${exactDocument.file.name}]\n${exactDocument.fullText}`
      : "";

    const selectedDocIds: number[] = Array.from(selectedDocuments);
    const selectedDocsMeta = (client.documents || [])
      .filter((doc) => selectedDocIds.includes(doc.id))
      .map((doc) => ({
        name: doc.name,
        size: doc.size_bytes,
        type: doc.file_type ? `application/${doc.file_type}` : "application/pdf",
      }));

    updateProposalData({
      title: proposalName,
      clientName: client.name,
      description: proposalDescription,
      clientId: selectedClientId,
      templateId: null,
      templateType: "recreate",
      originalSections,
      originalSectionContents,
      exactDocumentName: exactDocument.file.name,
      // Set selectedSections from extracted section ids
      selectedSections: sections.map((s) => s.id),
      // Build display names from section titles
      sectionDisplayNames: Object.fromEntries(sections.map((s) => [s.id, s.title])),
      contextualInstructions,
      selectedDocumentIds: selectedDocIds,
      filesMeta: selectedDocsMeta,
    });

    setDraftStage("wizard_in_progress");
    setCurrentStep(4);
    markStepCompleted(3);
    router.push("/parameters");
    onClose();
  }

  // ── New Client Handlers ────────────────────────────────────────────────────

  function handleNewClientClick(): void {
    setModalView("new_client");
  }

  function handleBackToRecreateTemplate(): void {
    setModalView("recreate_template");
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

    const stillParsing = contextUploads.some((f) => f.status === "parsing");
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

      if (contextUploads.length > 0) {
        for (const uploaded of contextUploads) {
          try {
            await uploadDocumentToStore(newClient.id, uploaded.file);
          } catch (error) {
            console.error(`Failed to upload ${uploaded.file.name}:`, error);
            toast.error(`Failed to upload ${uploaded.file.name}`);
          }
        }
      }

      toast.success(`Client "${newClientFormData.clientName}" created successfully`);
      
      // Reload clients to get the newly created client with full data
      await loadClients();
      
      setSelectedClientId(newClient.id);
      setClientSearchQuery(newClient.name);
      setContextUploads([]);
      setModalView("recreate_template");
      setNewClientFormData({
        clientName: "",
        industry: "",
        pipelineStage: "Discovery",
        primaryContactName: "",
        primaryContactEmail: "",
        notes: "",
      });
    } catch (error) {
      console.error("Failed to create client:", error);
      toast.error("Failed to create client");
    } finally {
      setIsCreatingClient(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );
  const isParsing =
    exactDocument?.status === "parsing" ||
    contextUploads.some((f) => f.status === "parsing");

  if (!mounted) return null;

  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {modalView === "new_client" && (
              <button 
                className={styles.backBtn} 
                onClick={handleBackToRecreateTemplate}
                aria-label="Back to recreate template"
                style={{ 
                  background: "none", 
                  border: "none", 
                  cursor: "pointer", 
                  padding: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-bg-hover, rgba(0,0,0,0.05))"}
                onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h2 className={styles.modalTitle}>
                {modalView === "new_client" ? "Add New Client" : "Recreate Template"}
              </h2>
              <p className={styles.modalSubtitle}>
                {modalView === "new_client"
                  ? "Enter details to provision a new client workspace."
                  : <>Upload an <strong>exact document</strong> to extract its structure, then provide context to rewrite it</>}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {modalView === "new_client" ? (
            <>
              <div className={styles.section}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Client Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Acme Corporation"
                    value={newClientFormData.clientName}
                    onChange={(e) => handleNewClientInputChange("clientName", e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Industry</label>
                  <select
                    className={styles.select}
                    value={newClientFormData.industry}
                    onChange={(e) => handleNewClientInputChange("industry", e.target.value)}
                  >
                    <option value="">Select industry...</option>
                    {INDUSTRIES.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  Initial Context & Notes
                  <span className={styles.optional}>Optional</span>
                </h3>

                <div className={styles.formGroup}>
                  <textarea
                    className={styles.textarea}
                    placeholder="Add any background context, specific requirements, or initial observations..."
                    value={newClientFormData.notes}
                    onChange={(e) => handleNewClientInputChange("notes", e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Upload Documents</h3>

                <label
                  htmlFor="new-client-file-upload-recreate"
                  className={`${styles.uploadZone} ${contextDragOver ? styles.dragOver : ""}`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setContextDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setContextDragOver(false); }}
                  onDrop={handleContextDrop}
                >
                  <Upload size={24} className={styles.uploadIcon} aria-hidden="true" />
                  <div className={styles.uploadText}>
                    Click to upload or drag and drop
                  </div>
                  <div className={styles.uploadHint}>
                    PDF, DOCX, TXT, PNG, JPG, JPEG, XLSX, PPTX (max 10MB each)
                  </div>
                  <input
                    id="new-client-file-upload-recreate"
                    ref={contextInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
                    multiple
                    onChange={handleContextInputChange}
                    className={styles.visuallyHidden}
                  />
                </label>

                {contextUploads.length > 0 && (
                  <div className={styles.uploadedFilesList}>
                    {contextUploads.map((entry) => (
                      <div key={entry.id} className={styles.uploadedFileItem}>
                        <div className={styles.fileIconWrapper}>
                          {entry.status === "parsing" ? (
                            <Loader2 size={18} className={`${styles.fileIcon} ${styles.spinningIcon}`} />
                          ) : entry.status === "error" ? (
                            <AlertCircle size={18} className={`${styles.fileIcon} ${styles.errorIcon}`} />
                          ) : entry.status === "parsed" ? (
                            <CheckCircle size={18} className={`${styles.fileIcon} ${styles.successIcon}`} />
                          ) : (
                            <FileText size={18} className={styles.fileIcon} />
                          )}
                        </div>
                        <div className={styles.fileDetails}>
                          <div className={styles.fileName} title={entry.file.name}>{entry.file.name}</div>
                          <div className={styles.fileMeta}>
                            {entry.status === "parsing" && <span className={styles.parsingStatus}>Parsing on server...</span>}
                            {entry.status === "parsed" && entry.parsedData && <span className={styles.parsedStatus}>{entry.parsedData.word_count} words</span>}
                            {entry.status === "error" && entry.error && <span className={styles.errorStatus}>{entry.error}</span>}
                          </div>
                        </div>
                        <button
                          className={styles.removeFileBtn}
                          onClick={() => setContextUploads((prev) => prev.filter((f) => f.id !== entry.id))}
                          title={entry.status === "parsing" ? "Cancel parsing and remove" : "Remove file"}
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
              {/* ── Client ─────────────────────────────────────────────────────── */}
              <div className={styles.section}>
                <label className={styles.label}>Client Name</label>
            {loading ? (
              <div className={styles.noClients}>
                <p>Loading clients...</p>
              </div>
            ) : clients.length === 0 ? (
              <div className={styles.noClients}>
                <p>No clients found.</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleNewClientClick}
                >
                  <Plus size={16} /> New Client
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
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  />
                  <button
                    className={styles.newClientBtn}
                    onClick={handleNewClientClick}
                  >
                    <Plus size={16} /> New Client
                  </button>
                </div>
                {showClientDropdown && filteredClients.length > 0 && (
                  <div className={styles.clientDropdown}>
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        className={`${styles.clientOption} ${
                          selectedClientId === client.id ? styles.selectedClient : ""
                        }`}
                        onClick={() => handleClientSelect(client.id, client.name)}
                      >
                        <span className={styles.clientName}>{client.name}</span>
                        <span className={styles.clientDocs}>
                          {(client.documents || []).length} doc(s)
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Proposal name ──────────────────────────────────────────────── */}
          <div className={styles.section}>
            <label className={styles.label}>Proposal Name</label>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="e.g. Rewritten Proposal for Acme Corp"
              value={proposalName}
              onChange={(e) => setProposalName(e.target.value)}
            />
          </div>

          {/* ── Project brief ──────────────────────────────────────────────── */}
          <div className={styles.section}>
            <label className={styles.label}>
              Project Brief <span className={styles.optionalBadge}>Optional</span>
            </label>
            <textarea
              className={styles.descriptionTextarea}
              placeholder="Describe the new project context that will replace the original document content..."
              value={proposalDescription}
              onChange={(e) => setProposalDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* ── SECTION 1: Exact Document ──────────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <FileSearch size={16} />
              <label className={styles.label} style={{ marginBottom: 0 }}>
                Exact Document <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <span className={styles.sectionBadge}>Structure Source · 1 file only</span>
            </div>
            <p className={styles.sectionHint}>
              Upload the original document whose structure you want to preserve. Its sections will be extracted and rewritten.
            </p>

            {!exactDocument ? (
              <label
                className={`${styles.uploadArea} ${exactDragOver ? styles.dragOver : ""}`}
                onDragOver={(e) => { e.preventDefault(); setExactDragOver(true); }}
                onDragLeave={() => setExactDragOver(false)}
                onDrop={handleExactDrop}
              >
                <input
                  ref={exactInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
                  style={{ display: "none" }}
                  onChange={handleExactInputChange}
                />
                <Upload size={24} className={styles.uploadIcon} />
                <span className={styles.uploadText}>
                  Drop document here or <strong>browse</strong>
                </span>
                <span className={styles.uploadHint}>PDF, DOCX, TXT, PNG, JPG, JPEG, XLSX, PPTX · max 10 MB</span>
              </label>
            ) : (
              <div className={styles.uploadedFilesList}>
                <div className={styles.uploadedFileItem}>
                  <div className={styles.fileIcon}>
                    {exactDocument.status === "parsing" ? (
                      <Loader2 size={16} className={styles.spinIcon} />
                    ) : exactDocument.status === "parsed" ? (
                      <CheckCircle size={16} className={styles.successIcon} />
                    ) : (
                      <AlertCircle size={16} className={styles.errorIcon} />
                    )}
                  </div>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{exactDocument.file.name}</span>
                    <span className={styles.fileSize}>
                      {exactDocument.status === "parsing" && "Extracting sections..."}
                      {exactDocument.status === "parsed" &&
                        `${exactDocument.sections?.length ?? 0} sections extracted · ${formatFileSize(exactDocument.file.size)}`}
                      {exactDocument.status === "error" && (exactDocument.error ?? "Parse error")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {exactDocument.status === "error" && (
                      <button
                        className={styles.retryBtn}
                        onClick={() => handleExactFileSelected(exactDocument.file)}
                        title="Retry parsing"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                    <button
                      className={styles.removeFileBtn}
                      onClick={handleRemoveExactDocument}
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Extracted sections preview */}
                {exactDocument.status === "parsed" && exactDocument.sections && (
                  <div className={styles.sectionsPreview}>
                    <p className={styles.sectionsPreviewLabel}>
                      Extracted Sections ({exactDocument.sections.length})
                    </p>
                    <div className={styles.sectionsList}>
                      {exactDocument.sections.map((s, i) => {
                        const level = s.level || 1;
                        const indentPx = (level - 1) * 20;
                        return (
                          <div 
                            key={s.id} 
                            className={styles.sectionPreviewItem}
                            style={{ paddingLeft: `${indentPx}px` }}
                          >
                            <span className={styles.sectionOrder}>{i + 1}</span>
                            <span className={styles.sectionTitle} style={{ fontWeight: level === 1 ? 600 : 400 }}>
                              {s.title}
                            </span>
                            {s.parentId && (
                              <span className={styles.childIndicator} title="Child section">↳</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION 2: Context Documents ───────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <FileText size={16} />
              <label className={styles.label} style={{ marginBottom: 0 }}>
                Context Documents
              </label>
              <span className={styles.sectionBadge}>Content Source · Multiple allowed</span>
            </div>
            <p className={styles.sectionHint}>
              Select existing client documents or upload new ones. These provide the context for rewriting each section.
            </p>

            {/* Existing KB docs */}
            {selectedClient && (selectedClient.documents || []).length > 0 && (
              <div className={styles.documentsSection}>
                <div className={styles.documentsHeader}>
                  <span className={styles.documentsTitle}>Knowledge Base</span>
                  <button className={styles.toggleAllBtn} onClick={toggleAllDocuments}>
                    {selectedDocuments.size ===
                    (selectedClient.documents || []).filter((d) => d.status === "parsed").length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
                <div className={styles.documentsList}>
                  {(selectedClient.documents || [])
                    .filter((d) => d.status === "parsed")
                    .map((doc) => (
                      <button
                        key={doc.id}
                        className={`${styles.documentItem} ${
                          selectedDocuments.has(doc.id) ? styles.selectedDocument : ""
                        }`}
                        onClick={() => toggleDocument(doc.id)}
                      >
                        <span className={styles.docCheckbox}>
                          {selectedDocuments.has(doc.id) ? (
                            <CheckSquare size={16} className={styles.checkIcon} />
                          ) : (
                            <Square size={16} />
                          )}
                        </span>
                        <FileText size={14} className={styles.docFileIcon} />
                        <span className={styles.docName}>{doc.name}</span>
                        <span className={styles.docSize}>
                          {formatFileSize(doc.size_bytes)}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Upload additional context files */}
            <label
              className={`${styles.uploadArea} ${contextDragOver ? styles.dragOver : ""} ${styles.uploadAreaCompact}`}
              onDragOver={(e) => { e.preventDefault(); setContextDragOver(true); }}
              onDragLeave={() => setContextDragOver(false)}
              onDrop={handleContextDrop}
            >
              <input
                ref={contextInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.xlsx,.pptx"
                multiple
                style={{ display: "none" }}
                onChange={handleContextInputChange}
              />
              <Upload size={20} className={styles.uploadIcon} />
              <span className={styles.uploadText}>
                Add more context files
              </span>
              <span className={styles.uploadHint}>PDF, DOCX, TXT, PNG, JPG, JPEG, XLSX, PPTX · max 10 MB each</span>
            </label>

            {/* Context uploads in progress */}
            {contextUploads.length > 0 && (
              <div className={styles.uploadedFilesList}>
                {contextUploads.map((entry) => (
                  <div key={entry.id} className={styles.uploadedFileItem}>
                    <div className={styles.fileIcon}>
                      {entry.status === "parsing" ? (
                        <Loader2 size={16} className={styles.spinIcon} />
                      ) : entry.status === "parsed" ? (
                        <CheckCircle size={16} className={styles.successIcon} />
                      ) : (
                        <AlertCircle size={16} className={styles.errorIcon} />
                      )}
                    </div>
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{entry.file.name}</span>
                      <span className={styles.fileSize}>
                        {entry.status === "parsing" && "Parsing..."}
                        {entry.status === "parsed" && `${entry.parsedData?.word_count ?? 0} words`}
                        {entry.status === "error" && (entry.error ?? "Error")}
                      </span>
                    </div>
                    <button
                      className={styles.removeFileBtn}
                      onClick={() =>
                        setContextUploads((prev) => prev.filter((f) => f.id !== entry.id))
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          {modalView === "new_client" ? (
            <>
              <button className="btn btn-secondary" onClick={handleBackToRecreateTemplate}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateClient}
                disabled={isCreatingClient || !newClientFormData.clientName.trim() || !newClientFormData.industry}
              >
                {isCreatingClient ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    Creating...
                  </>
                ) : (
                  "Create Client"
                )}
              </button>
            </>
          ) : (
            <>
              <div className={styles.footerInfo}>
                {isParsing && (
                  <span className={styles.parsingIndicator}>
                    <Loader2 size={14} className={styles.spinIcon} />
                    Processing documents...
                  </span>
                )}
                {exactDocument?.status === "parsed" && !isParsing && (
                  <span className={styles.readyIndicator}>
                    <CheckCircle size={14} />
                    {exactDocument.sections?.length} section(s) ready
                  </span>
                )}
              </div>
              <div className={styles.footerActions}>
                <button className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleContinue}
                  disabled={isParsing || !exactDocument || exactDocument.status !== "parsed"}
                >
                  Continue to Parameters
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
