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
