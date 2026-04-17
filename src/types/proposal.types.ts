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

export type TemplateType = "predefined" | "custom" | "scratch";

export interface FileMeta {
  name: string;
  size: number;
  type: string;
}

export interface ProposalData {
  id?: number;
  title: string;
  clientName: string;
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
  // Template selection (set in wizard step 3)
  templateId: string | null;
  templateType: TemplateType;
  // Response fields from backend
  status?: string;
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
  clientName: string;
  status: string;
  tone: string;
  lengthPreference: string;
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
