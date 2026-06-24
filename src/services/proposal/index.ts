/**
 * Proposal service barrel
 *
 * Re-exports all proposal-related service functions from their
 * single-responsibility sub-modules. Import from @/services/proposal
 * or from the legacy path @/services/proposal (both resolve here).
 *
 * Sub-modules:
 *   proposalCrud.service.ts        — create, get, list, download, cancel, approval
 *   proposalSections.service.ts    — add, remove, reorder, update, regenerate sections
 *   templateParser.service.ts      — template parsing, file parsing, section suggestions, AI recommendations
 *   proposalWizard.service.ts      — mark step visited, validate step access
 *   proposalVersioning.service.ts  — create version draft, family tree, delete version draft
 */

// CRUD
export {
  generateProposal,
  regenerateProposal,
  getProposalStatus,
  getProposal,
  listProposals,
  listProposalHistory,
  getDownloadUrl,
  getProposalPdfUrl,
  cancelProposal,
  updateApprovalStatus,
  estimateProposalHours,
} from "./proposalCrud.service";

export type {
  ProposalStatus,
  ListProposalsParams,
  PaginatedProposalResponse,
} from "./proposalCrud.service";

// Sections
export {
  updateSection,
  regenerateSection,
  regenerateSelection,
  addProposalSection,
  removeProposalSection,
  reorderProposalSections,
} from "./proposalSections.service";

export type { AddSectionPayload, ReorderSectionsPayload } from "./proposalSections.service";

// Template parsing & AI recommendations
export {
  parseCustomTemplate,
  parseFiles,
  suggestSections,
  getSectionRecommendations,
} from "./templateParser.service";

export type {
  ExtractedTemplateSection,
  ParseTemplateResult,
  ParsedFileResult,
  ParseFilesResponse,
  SuggestSectionsPayload,
  SuggestedSection,
  SectionRecommendation,
  ExistingSectionWithRules,
  RecommendSectionsRequest,
} from "./templateParser.service";

// Wizard step navigation
export { markProposalStepVisited, validateProposalStepAccess } from "./proposalWizard.service";

// Versioning
export { createVersionDraft, deleteVersionDraft } from "./proposalVersioning.service";
