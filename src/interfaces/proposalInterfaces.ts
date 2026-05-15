export interface ProposalSection {
  key: string;
  displayName: string;
  content: string;
}

export interface CustomSection {
  key: string;
  label: string;
  description: string;
}

export type TemplateType = "predefined" | "custom" | "scratch" | "recreate" | "mvp" | "poc" | "design" | "brd" | "frd" | "srs" | "architecture" | "sow";

export interface OriginalSection {
  id: string;
  title: string;
  content: string;
  order: number;
  type: "text" | "table" | "mixed";
  level?: number;
  parentId?: string;
}

export interface FileMeta {
  name: string;
  size: number;
  type: string;
}

// ─── Domain-Driven Types ─────────────────────────────────────────────────────

/**
 * Core wizard form input fields
 * These are the user-provided inputs during the proposal creation wizard
 */
export interface ProposalFormInput {
  title: string;
  clientName: string;
  clientId?: number;
  description: string;
  tone: ToneOption;
  lengthPreference: LengthOption;
  language: string;
  aiModel: string;
  selectedSections: string[];
  sectionDisplayNames: Record<string, string>;
  customSections: CustomSection[];
  contextualInstructions: string;
  webReferences: string[];
  files: File[];
  filesMeta: FileMeta[];
  selectedDocumentIds?: number[];
  templateId: string | null;
  templateType: TemplateType;
}

/**
 * Recreate-mode specific fields
 * Only present when templateType is "recreate"
 */
export interface RecreateModeState {
  originalSections: OriginalSection[];
  originalSectionContents: Record<string, string>;
  exactDocumentName: string;
}

/**
 * Proposal generation state from backend
 * These fields come from API responses during/after generation
 */
export interface ProposalGenerationState {
  status?: string;
  sections?: Record<string, string>;
  sectionTypes?: Record<string, string>;
  generatingSection?: string | null;
}

/**
 * Approval workflow state
 */
export interface ProposalApprovalState {
  approvalStatus?: "pending" | "approved" | "rejected";
}

/**
 * Persistence metadata
 * Database-managed fields
 */
export interface ProposalMetadata {
  id?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Discriminated union for mode-specific proposal data
 */
export type ProposalModeData =
  | { templateType: "predefined" | "custom" | "scratch" }
  | { templateType: "recreate" } & RecreateModeState;

// ─── Raw Backend DTO Interfaces ─────────────────────────────────────────────

/**
 * Raw backend DTO for proposal data (snake_case from backend)
 * Used for mapping backend responses to frontend types
 */
export interface RawProposalData {
  id?: number;
  title?: string;
  client_name?: string;
  client_id?: number;
  description?: string;
  tone?: string;
  length_preference?: string;
  language?: string;
  ai_model?: string;
  selected_sections?: string[];
  section_display_names?: Record<string, string>;
  custom_sections?: Array<{
    key: string;
    label: string;
    description: string;
  }>;
  contextual_instructions?: string;
  web_references?: string[];
  files_meta?: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  selected_document_ids?: number[];
  template_id?: string | null;
  template_type?: string;
  original_sections?: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
    type: string;
    level?: number;
    parent_id?: string;
  }>;
  original_section_contents?: Record<string, string>;
  exact_document_name?: string;
  status?: string;
  approval_status?: string;
  sections?: Record<string, string>;
  section_types?: Record<string, string>;
  generating_section?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Raw backend DTO for version snapshot (snake_case from backend)
 */
export interface RawProposalVersionSnapshot {
  proposal_data?: RawProposalData;
  generated_content?: Record<string, string>;
  section_types?: Record<string, string>;
  metadata?: {
    ai_model?: string;
    tone?: string;
    length_preference?: string;
    language?: string;
    contextual_instructions?: string;
  };
}

// ─── Mapper Functions ───────────────────────────────────────────────────────

/**
 * Safely maps raw backend proposal data to ProposalFormInput
 * Provides safe defaults for missing fields
 */
export function mapRawProposalDataToFormInput(raw: RawProposalData | undefined): ProposalFormInput {
  if (!raw) {
    // Return empty form data if raw is undefined
    return {
      title: "",
      clientName: "",
      clientId: undefined,
      description: "",
      tone: "professional" as ToneOption,
      lengthPreference: "balanced" as LengthOption,
      language: "en",
      aiModel: "gpt-4o",
      selectedSections: [],
      sectionDisplayNames: {},
      customSections: [],
      contextualInstructions: "",
      webReferences: [],
      files: [],
      filesMeta: [],
      selectedDocumentIds: undefined,
      templateId: null,
      templateType: "scratch" as TemplateType,
    };
  }

  return {
    title: raw.title ?? "",
    clientName: raw.client_name ?? "",
    clientId: raw.client_id,
    description: raw.description ?? "",
    tone: (raw.tone as ToneOption) ?? "professional",
    lengthPreference: (raw.length_preference as LengthOption) ?? "balanced",
    language: raw.language ?? "en",
    aiModel: raw.ai_model ?? "gpt-4o",
    selectedSections: raw.selected_sections ?? [],
    sectionDisplayNames: raw.section_display_names ?? {},
    customSections:
      raw.custom_sections?.map((cs) => ({
        key: cs.key,
        label: cs.label,
        description: cs.description,
      })) ?? [],
    contextualInstructions: raw.contextual_instructions ?? "",
    webReferences: raw.web_references ?? [],
    files: [], // Files are not serialized from backend
    filesMeta:
      raw.files_meta?.map((fm) => ({
        name: fm.name,
        size: fm.size,
        type: fm.type,
      })) ?? [],
    selectedDocumentIds: raw.selected_document_ids,
    templateId: raw.template_id ?? null,
    templateType: (raw.template_type as TemplateType) ?? "scratch",
  };
}

/**
 * Safely maps raw backend proposal data to ProposalGenerationState
 */
export function mapRawProposalDataToGenerationState(raw: RawProposalData): ProposalGenerationState {
  return {
    status: raw.status,
    sections: raw.sections,
    sectionTypes: raw.section_types,
    generatingSection: raw.generating_section,
  };
}

/**
 * Safely maps raw backend proposal data to ProposalApprovalState
 */
export function mapRawProposalDataToApprovalState(raw: RawProposalData): ProposalApprovalState {
  return {
    approvalStatus: raw.approval_status as "pending" | "approved" | "rejected" | undefined,
  };
}

/**
 * Safely maps raw backend proposal data to ProposalMetadata
 */
export function mapRawProposalDataToMetadata(raw: RawProposalData): ProposalMetadata {
  return {
    id: raw.id,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Safely maps raw backend proposal data to full ProposalData (backward compatible)
 * Composes all domain mappers
 */
export function mapRawProposalData(raw: RawProposalData | undefined): ProposalData {
  if (!raw) {
    // Return empty proposal data if raw is undefined
    return {
      ...mapRawProposalDataToFormInput(undefined),
      ...mapRawProposalDataToGenerationState({} as RawProposalData),
      ...mapRawProposalDataToApprovalState({} as RawProposalData),
      ...mapRawProposalDataToMetadata({} as RawProposalData),
      originalSections: [],
      originalSectionContents: {},
      exactDocumentName: "",
    };
  }

  return {
    ...mapRawProposalDataToFormInput(raw),
    ...mapRawProposalDataToGenerationState(raw),
    ...mapRawProposalDataToApprovalState(raw),
    ...mapRawProposalDataToMetadata(raw),
    originalSections: raw.original_sections?.map((os) => ({
      id: os.id,
      title: os.title,
      content: os.content,
      order: os.order,
      type: os.type as "text" | "table" | "mixed",
      level: os.level,
      parentId: os.parent_id,
    })) ?? [],
    originalSectionContents: raw.original_section_contents,
    exactDocumentName: raw.exact_document_name,
  };
}

/**
 * Safely maps raw backend version snapshot to ProposalVersionSnapshot
 */
export function mapRawVersionSnapshot(raw: RawProposalVersionSnapshot): {
  proposalData: ProposalData;
  generatedContent: Record<string, string>;
  sectionTypes: Record<string, string>;
  metadata: {
    aiModel: string;
    tone: string;
    lengthPreference: string;
    language: string;
    contextualInstructions: string;
  };
} {
  return {
    proposalData: raw.proposal_data ? mapRawProposalData(raw.proposal_data) : ({} as ProposalData),
    generatedContent: raw.generated_content ?? {},
    sectionTypes: raw.section_types ?? {},
    metadata: {
      aiModel: raw.metadata?.ai_model ?? "gpt-4o",
      tone: raw.metadata?.tone ?? "professional",
      lengthPreference: raw.metadata?.length_preference ?? "balanced",
      language: raw.metadata?.language ?? "en",
      contextualInstructions: raw.metadata?.contextual_instructions ?? "",
    },
  };
}

/**
 * ProposalData - Backward-compatible composite interface
 *
 * This interface combines all domain types for existing consumers.
 * New code should prefer using the focused domain types directly.
 *
 * @deprecated Prefer using focused domain types (ProposalFormInput, ProposalGenerationState, etc.)
 */
export interface ProposalData
  extends ProposalFormInput,
    ProposalGenerationState,
    ProposalApprovalState,
    ProposalMetadata {
  // Recreate mode fields (optional for backward compatibility)
  originalSections?: OriginalSection[];
  originalSectionContents?: Record<string, string>;
  exactDocumentName?: string;
}

export type ToneOption = "professional" | "persuasive" | "technical" | "creative";
export type LengthOption = "concise" | "balanced" | "comprehensive";
export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface ProposalListItem {
  id: number;
  title: string;
  clientId: number;
  clientName: string;
  status: string;
  approvalStatus: "pending" | "approved" | "rejected";
  tone: ToneOption;
  lengthPreference: LengthOption;
  templateType: TemplateType;
  templateId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory = "Popular" | "Business" | "Technical" | "Creative" | "Documentation";

export interface ProposalTemplate {
  id: string;
  name: string;
  templateType: TemplateType;
  category: TemplateCategory;
  description: string;
  sections: string[];
  gradientClass: string;
  icon: string;
  isCustom?: boolean;
  uploadedAt?: string;
}

/**
 * Proposal generation status from polling endpoint
 * Represents the current state of proposal generation progress
 */
export interface ProposalStatus {
  id: number;
  status: string;
  totalSections: number;
  completedSections: string[];
  progressPercent: number; // Real-time progress percentage (0-100) from backend
  currentStage: string | null;
  currentSection: string | null;
  estimatedTimeRemaining: number | null;
  generatingSection: string | null; // deprecated: use currentSection
  selectedSections: string[] | null; // deprecated: use totalSections
  visitedPipelineSteps: number[];
  highestVisitedStep: number | null;
  progress: number; // backward-compat alias for progressPercent
}
