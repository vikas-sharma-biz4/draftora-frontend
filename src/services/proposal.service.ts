/**
 * Proposal service — legacy barrel re-export
 *
 * All implementation has been split into single-responsibility sub-modules:
 *   proposal/proposalCrud.service.ts     — create, get, list, download, cancel, approval
 *   proposal/proposalSections.service.ts  — add, remove, reorder, update, regenerate sections
 *   proposal/templateParser.service.ts    — template parsing, file parsing, section suggestions, AI recommendations
 *   proposal/proposalWizard.service.ts    — mark step visited, validate step access
 *
 * This file re-exports everything so existing imports continue to work.
 * New code should import from @/services/proposal instead.
 */

export {
  generateProposal,
  getProposalStatus,
  getProposal,
  listProposals,
  listProposalHistory,
  getDownloadUrl,
  cancelProposal,
  updateApprovalStatus,
  estimateProposalHours,
} from "./proposal/proposalCrud.service";

export type {
  ProposalStatus,
  ListProposalsParams,
  PaginatedProposalResponse,
} from "./proposal/proposalCrud.service";

export {
  updateSection,
  regenerateSection,
  regenerateSelection,
  addProposalSection,
  removeProposalSection,
  reorderProposalSections,
} from "./proposal/proposalSections.service";

export type {
  AddSectionPayload,
  ReorderSectionsPayload,
} from "./proposal/proposalSections.service";

export {
  parseCustomTemplate,
  parseRecreateDocument,
  parseFiles,
  getSupportedParseFormats,
  suggestSections,
  getSectionRecommendations,
} from "./proposal/templateParser.service";

export type {
  ExtractedTemplateSection,
  ParseTemplateResult,
  RecreateExtractedSection,
  ParseRecreateResult,
  ParsedFileResult,
  ParseFilesResponse,
  SuggestSectionsPayload,
  SuggestedSection,
  SectionRecommendation,
  ExistingSectionWithRules,
  RecommendSectionsRequest,
} from "./proposal/templateParser.service";

export {
  markProposalStepVisited,
  validateProposalStepAccess,
} from "./proposal/proposalWizard.service";
