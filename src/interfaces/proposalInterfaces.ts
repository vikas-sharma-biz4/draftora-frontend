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
 * backend API response (ProposalData).  Browser-specific types such as
 * `File` must NOT appear here — they belong only on ProposalWizardData.
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
 * Core wizard form data — extends ProposalBaseFields with browser File
 * objects that are only available during the wizard upload phase and are
 * never present on API responses.
 */
export interface ProposalWizardData extends ProposalBaseFields {
  files: File[];
}

/**
 * Full proposal shape as returned by the backend API.
 * Extends ProposalBaseFields directly — does NOT include `files: File[]`
 * because browser File objects are never returned by the server.
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
