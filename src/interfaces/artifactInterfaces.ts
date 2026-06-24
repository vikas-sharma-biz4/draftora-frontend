/**
 * TypeScript interfaces for the Artifact generation feature.
 *
 * Covers email and invoice artifacts generated from proposals.
 * The architecture is extensible — artifact_type is a string rather than
 * a union so future types (SOW, Contract, etc.) require no interface changes.
 */

export type ArtifactType = "email" | "invoice" | "nda" | "podcast";

export interface GeneratedArtifact {
  id: number;
  clientId: number;
  proposalId: number | null;
  templateId: string;
  artifactType: ArtifactType;
  title: string;
  /** Full HTML content of the artifact */
  content: string;
  version: number;
  /** Flexible metadata — email: {subject}, invoice: {invoice_number, line_items} */
  metadataJson: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Display metadata for a template card in Step 1 */
export interface ArtifactTemplate {
  id: string;
  displayName: string;
  description: string;
}

/** Content-inclusion flags for email generation */
export interface ArtifactOptions {
  includeSummary: boolean;
  includeScope: boolean;
  includeStrengths: boolean;
  includePodcast: boolean;
}

/** A single milestone with its associated cost for invoice generation */
export interface MilestoneCost {
  milestone: string;
  amount: number;
}

/** User-provided invoice details collected in the invoice details form */
export interface InvoiceFormData {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  companyName: string;
  jobToBeDone: string;
  milestoneCosts: MilestoneCost[];
}

/** Second-party details collected in the NDA generation form */
export interface NdaFormData {
  clientName: string;
  clientCompany: string;
  date: string;
}

/** Request body for POST /artifacts/generate */
export interface ArtifactGenerateRequest {
  clientId: number;
  proposalId?: number;
  templateId: string;
  artifactType: ArtifactType;
  title: string;
  additionalInstructions?: string;
  options?: ArtifactOptions;
  createdBy?: string;
  /** Passed when proposal is not selected, used as fallback for client name in email prompt */
  clientName?: string;
  invoiceMetadata?: InvoiceFormData;
  ndaMetadata?: NdaFormData;
}

/** Request body for PUT /artifacts/{id} */
export interface ArtifactUpdateRequest {
  content: string;
  title?: string;
  metadataJson?: Record<string, unknown>;
}
