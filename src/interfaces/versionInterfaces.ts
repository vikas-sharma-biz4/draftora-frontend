import type { ProposalData } from "./proposalInterfaces";

export type VersionDecision = "accepted" | "rejected" | "pending";
export type VersionSource = "generated" | "edited" | "regenerated";

export interface ProposalVersionSnapshot {
  proposalData: ProposalData;
  generatedContent: Record<string, string>;
  sectionTypes: Record<string, string>;
  mermaidDiagram?: string;
  metadata: {
    aiModel: string;
    tone: string;
    lengthPreference: string;
    language: string;
    contextualInstructions: string;
  };
}

export interface ProposalVersion {
  id: string;
  proposalId: number;
  version: number;
  source: VersionSource;
  decision: VersionDecision;
  snapshot: ProposalVersionSnapshot;
  createdAt: string;
  createdBy?: string;
  parentVersion?: number;
  changeDescription?: string;
}

export interface VersionHistory {
  proposalId: number;
  currentVersion: number;
  versions: ProposalVersion[];
  acceptedVersions: number[];
  rejectedVersions: number[];
}

export interface CreateVersionPayload {
  proposalId: number;
  source: VersionSource;
  snapshot: ProposalVersionSnapshot;
  parentVersion?: number;
  changeDescription?: string;
}

export interface UpdateVersionDecisionPayload {
  versionId: string;
  decision: VersionDecision;
}

export interface RegenerateFromVersionPayload {
  versionId: string;
  modifications: {
    tone?: string;
    lengthPreference?: string;
    contextualInstructions?: string;
    selectedSections?: string[];
  };
}
