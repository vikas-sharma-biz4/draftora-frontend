/**
 * Centralised user-facing message strings
 *
 * @deprecated This file is being migrated to use next-intl for i18n support.
 * New code should use the `useTranslations` hook from next-intl:
 *   const t = useTranslations("messages");
 *   t("generic.error");
 *
 * This compatibility layer preserves existing MESSAGES usage during migration.
 * After migration is complete, this file can be removed.
 *
 * Migration guide:
 * - Import: import { useTranslations } from "next-intl";
 * - Usage: const t = useTranslations("messages");
 * - Replace: MESSAGES.GENERIC_ERROR → t("generic.error")
 */

import enMessages from "@/messages/en.json";

/**
 * Compatibility layer for existing MESSAGES usage during i18n migration.
 * This provides the same API as the original MESSAGES constant but sources
 * strings from the translation files for consistency.
 */
export const MESSAGES = {
  GENERIC_ERROR:   enMessages.generic.error,
  GENERIC_SUCCESS: enMessages.generic.success,
  LOADING:         enMessages.generic.loading,
  SAVING:          enMessages.generic.saving,
  DELETING:        enMessages.generic.deleting,

  AUTH_LOGIN_SUCCESS:       enMessages.auth.loginSuccess,
  AUTH_LOGOUT_SUCCESS:      enMessages.auth.logoutSuccess,
  AUTH_INVALID_CREDENTIALS: enMessages.auth.invalidCredentials,
  AUTH_SESSION_EXPIRED:     enMessages.auth.sessionExpired,
  AUTH_PASSWORD_RESET_SENT: enMessages.auth.passwordResetSent,
  AUTH_PASSWORD_CHANGED:    enMessages.auth.passwordChanged,

  CLIENT_CREATED:   enMessages.client.created,
  CLIENT_UPDATED:   enMessages.client.updated,
  CLIENT_DELETED:   enMessages.client.deleted,
  CLIENT_NOT_FOUND: enMessages.client.notFound,

  DOCUMENT_UPLOADED:    enMessages.document.uploaded,
  DOCUMENT_DELETED:     enMessages.document.deleted,
  DOCUMENT_UPLOAD_FAIL: enMessages.document.uploadFailed,

  PROPOSAL_CREATED:                enMessages.proposal.created,
  PROPOSAL_DELETED:                enMessages.proposal.deleted,
  PROPOSAL_GENERATION_STARTED:     enMessages.proposal.generationStarted,
  PROPOSAL_GENERATION_DONE:        enMessages.proposal.generationDone,
  PROPOSAL_GENERATION_FAILED:      enMessages.proposal.generationFailed,
  PROPOSAL_SECTION_SAVED:          enMessages.proposal.sectionSaved,
  PROPOSAL_SECTION_SAVE_FAILED:    enMessages.proposal.sectionSaveFailed,
  PROPOSAL_SECTION_REGENERATED:    enMessages.proposal.sectionRegenerated,
  PROPOSAL_SECTION_REGEN_FAILED:   enMessages.proposal.sectionRegenFailed,
  PROPOSAL_SECTION_REMOVED:        enMessages.proposal.sectionRemoved,
  PROPOSAL_SECTION_REMOVE_FAILED:  enMessages.proposal.sectionRemoveFailed,
  PROPOSAL_SECTION_ADDED:          (name: string): string => enMessages.proposal.sectionAdded.replace("{name}", name),
  PROPOSAL_SECTION_ADD_FAILED:     enMessages.proposal.sectionAddFailed,
  PROPOSAL_SECTION_GENERATING:     enMessages.proposal.sectionGenerating,
  PROPOSAL_APPROVED:               enMessages.proposal.approved,
  PROPOSAL_REJECTED:               enMessages.proposal.rejected,
  PROPOSAL_APPROVE_FAILED:         enMessages.proposal.approveFailed,
  PROPOSAL_REJECT_FAILED:          enMessages.proposal.rejectFailed,
  PROPOSAL_DOWNLOADED:             enMessages.proposal.downloaded,
  PROPOSAL_DOWNLOAD_FAILED:        enMessages.proposal.downloadFailed,
  PROPOSAL_SECTION_NAME_EMPTY:     enMessages.proposal.sectionNameEmpty,
  PROPOSAL_SECTION_NAME_EXISTS:    enMessages.proposal.sectionNameExists,
  PROPOSAL_MIN_SECTIONS:           enMessages.proposal.minSections,

  DRAFT_SAVED:       enMessages.draft.saved,
  DRAFT_RESTORED:    enMessages.draft.restored,
  DRAFT_DELETED:     enMessages.draft.deleted,
  DRAFT_ALL_DELETED: enMessages.draft.allDeleted,

  UPLOAD_IN_PROGRESS:  enMessages.upload.inProgress,
  UPLOAD_SUCCESS:      enMessages.upload.success,
  UPLOAD_FAILED:       enMessages.upload.failed,
  UPLOAD_TOO_LARGE:    enMessages.upload.tooLarge,
  UPLOAD_INVALID_TYPE: enMessages.upload.invalidType,

  VALIDATION_REQUIRED:      enMessages.validation.required,
  VALIDATION_EMAIL:         enMessages.validation.email,
  VALIDATION_MIN_LENGTH:    (min: number): string => enMessages.validation.minLength.replace("{min}", min.toString()),
  VALIDATION_MAX_LENGTH:    (max: number): string => enMessages.validation.maxLength.replace("{max}", max.toString()),
  VALIDATION_PASSWORD_WEAK: enMessages.validation.passwordWeak,
} as const;
