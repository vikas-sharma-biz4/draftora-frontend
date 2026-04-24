export type DocumentStatus = "parsed" | "processing";

export interface ClientDocument {
  id: string;
  name: string;
  size: string;
  date: string;
  status: DocumentStatus;
  fileType: "pdf" | "docx" | "xlsx" | "pptx";
  selected?: boolean;
}

export interface ProposalHistoryItem {
  id: string;
  name: string;
  version: string;
  type: string;
  date: string;
  status: "finalized" | "in-review" | "draft";
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  tier: string;
  onboardedDate: string;
  status: "active" | "inactive";
  documents: ClientDocument[];
  proposals: ProposalHistoryItem[];
  primaryContact?: {
    name: string;
    email: string;
  };
  pipelineStage?: string;
  notes?: string;
}

export interface NewClientFormData {
  clientName: string;
  industry: string;
  pipelineStage: string;
  primaryContactName: string;
  primaryContactEmail: string;
  notes: string;
}
