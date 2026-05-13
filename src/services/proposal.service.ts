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

import { generateProposal } from "./proposal/proposalCrud.service";
import { getProposal, listProposals, getDownloadUrl, cancelProposal, updateApprovalStatus } from "./proposal/proposalCrud.service";
import { getProposalStatus } from "./proposal/proposalCrud.service";
import type { ListProposalsParams } from "./proposal/proposalCrud.service";
import type { ProposalStatus } from "@/interfaces/proposalInterfaces";

export {
  generateProposal,
  getProposalStatus,
  getProposal,
  listProposals,
  getDownloadUrl,
  cancelProposal,
  updateApprovalStatus,
} from "./proposal/proposalCrud.service";

export type { ListProposalsParams };

export {
  updateSection,
  regenerateSection,
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
