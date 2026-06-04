export interface ProposalHistoryItem {
  id: string;
  name: string;
  version: string;
  type: string;
  date: string;
  status: "finalized" | "in-review" | "draft";
}

export interface NewClientFormData {
  clientName: string;
  industry: string;
  pipelineStage: string;
  primaryContactName: string;
  primaryContactEmail: string;
  notes: string;
}

// ─── Client Domain Interfaces ─────────────────────────────────────────────────

export interface Client {
  id: number;
  name: string;
  industry: string;
  status: "active" | "inactive";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDocument {
  id: number;
  clientId: number;
  name: string;
  fileType: string;
  sizeBytes: number;
  status: "processing" | "parsed" | "error";
  s3FileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientWithDocuments extends Client {
  documents: ClientDocument[];
}

export interface CreateClientRequest {
  name: string;
  industry: string;
  notes?: string;
}

export interface UpdateClientRequest {
  name?: string;
  industry?: string;
  status?: "active" | "inactive";
  notes?: string;
}
