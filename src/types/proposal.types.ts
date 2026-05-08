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

export type TemplateType = "predefined" | "custom" | "scratch" | "recreate";

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

export interface ProposalData {
  id?: number;
  title: string;
  clientName: string;
  clientId?: number;
  description: string;
  tone: string;
  lengthPreference: string;
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
  // Template selection (set in wizard step 3)
  templateId: string | null;
  templateType: TemplateType;
  // Recreate mode: sections extracted from the exact document
  originalSections?: OriginalSection[];
  // Recreate mode: maps section_key -> original content for rewrite prompts
  originalSectionContents?: Record<string, string>;
  // Recreate mode: filename of the uploaded exact document
  exactDocumentName?: string;
  // Response fields from backend
  status?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  sections?: Record<string, string>;
  /** Maps section_key → content type: "table" | "bullets" | "diagram" | "paragraph" */
  sectionTypes?: Record<string, string>;
  generatingSection?: string | null;
  mermaidDiagram?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ToneOption = "professional" | "persuasive" | "technical" | "creative";
export type LengthOption = "concise" | "balanced" | "comprehensive";
export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown | null;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ProposalListItem {
  id: number;
  title: string;
  clientId: number;
  clientName: string;
  status: string;
  approvalStatus: "pending" | "approved" | "rejected";
  tone: string;
  lengthPreference: string;
  templateType: TemplateType;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory = "Popular" | "Business" | "Technical" | "Creative";

export interface ProposalTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  sections: string[];
  isCustom?: boolean;
  uploadedAt?: string;
}
