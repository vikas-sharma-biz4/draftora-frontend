export interface TeamRoleEstimate {
  role: string;
  hours: number;
  description: string;
}

export interface TotalEstimate {
  hours: number;
  description: string;
}

export interface EstimatedHoursData {
  totalEstimatedHours: TotalEstimate;
  teamBreakdown: TeamRoleEstimate[];
  featureListUsed: string;
  customPromptUsed?: string | null;
}

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

export type TemplateType =
  | "predefined"
  | "custom"
  | "scratch"
  | "mvp"
  | "poc"
  | "design"
  | "brd"
  | "frd"
  | "srs"
  | "architecture"
  | "sow";

export interface FileMeta {
  name: string;
  size: number;
  type: string;
}

/**
 * Fields shared between the wizard form input (ProposalWizardData) and the
 * backend API response (ProposalData).
 */
export interface ProposalBaseFields {
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
  filesMeta: FileMeta[];
  selectedDocumentIds?: number[];
  templateId: string | null;
  templateType: TemplateType;
  // Cross-cutting wizard fields
  approvalStatus?: "pending" | "approved" | "rejected";
  sections?: Record<string, string>;
}

/**
 * Core wizard form data — extends ProposalBaseFields with wizard-only fields.
 */
export interface ProposalWizardData extends ProposalBaseFields {}

/**
 * Full proposal shape as returned by the backend API.
 */
export interface ProposalData extends ProposalBaseFields {
  id?: number;
  status?: string;
  /** Maps section_key → content type: "table" | "bullets" | "diagram" | "paragraph" */
  sectionTypes?: Record<string, string>;
  generatingSection?: string | null;
  estimatedHoursData?: EstimatedHoursData | null;
  createdAt?: string;
  updatedAt?: string;
  // Versioning hierarchy fields
  versionLabel?: string | null;
  parentProposalId?: number | null;
  rootProposalId?: number | null;
}

export type ToneOption = "professional" | "persuasive" | "technical" | "creative";
export type LengthOption = "concise" | "balanced" | "comprehensive";
export type WizardStep = 1 | 2 | 3;

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
  version?: number | null;
  // Versioning hierarchy fields
  versionLabel?: string | null;
  parentProposalId?: number | null;
  rootProposalId?: number | null;
}

// --- Versioning types ---

export type VersionDraftTrigger = "section_edit" | "review_edit" | "duplicate" | "restore";

export interface VersionDraftOut {
  id: number;
  versionLabel: string;
  parentProposalId: number;
  rootProposalId: number;
  approvalStatus: string;
  status: string;
  title: string;
  createdAt: string;
}

export interface FamilyTreeItem {
  id: number;
  versionLabel: string;
  approvalStatus: string;
  status: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalFamilyTree {
  rootId: number;
  versions: FamilyTreeItem[];
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
