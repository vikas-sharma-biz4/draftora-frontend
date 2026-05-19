/**
 * Centralised user-facing message strings
 *
 * All toast copy, error messages, and UI labels live here
 * for consistent wording and easy localisation.
 */

export const MESSAGES = {
  GENERIC_ERROR:   "Something went wrong. Please try again.",
  GENERIC_SUCCESS: "Operation completed",
  LOADING:         "Loading\u2026",
  SAVING:          "Saving\u2026",
  DELETING:        "Deleting\u2026",

  AUTH_LOGIN_SUCCESS:       "Signed in",
  AUTH_LOGOUT_SUCCESS:      "Signed out",
  AUTH_INVALID_CREDENTIALS: "Invalid email or password.",
  AUTH_SESSION_EXPIRED:     "Your session has expired. Please sign in again.",
  AUTH_PASSWORD_RESET_SENT: "Password reset link sent to your email.",
  AUTH_PASSWORD_CHANGED:    "Password changed",

  CLIENT_CREATED:   "Client created",
  CLIENT_UPDATED:   "Client updated",
  CLIENT_DELETED:   "Client deleted",
  CLIENT_NOT_FOUND: "Client not found.",

  DOCUMENT_UPLOADED:    "Document uploaded",
  DOCUMENT_DELETED:     "Document deleted",
  DOCUMENT_UPLOAD_FAIL: "Failed to upload document. Please try again.",

  PROPOSAL_CREATED:                "Proposal created",
  PROPOSAL_DELETED:                "Proposal deleted",
  PROPOSAL_GENERATION_STARTED:     "Generating your proposal\u2026",
  PROPOSAL_GENERATION_DONE:        "Proposal generated",
  PROPOSAL_GENERATION_FAILED:      "Proposal generation failed. Please try again.",
  PROPOSAL_SECTION_SAVED:          "Section saved",
  PROPOSAL_SECTION_SAVE_FAILED:    "Failed to save section.",
  PROPOSAL_SECTION_REGENERATED:    "Section regenerated",
  PROPOSAL_SECTION_REGEN_FAILED:   "Regeneration failed.",
  PROPOSAL_SECTION_REMOVED:        "Section removed",
  PROPOSAL_SECTION_REMOVE_FAILED:  "Failed to remove section.",
  PROPOSAL_SECTION_ADDED:          (name: string): string => `"${name}" section added with AI-generated content!`,
  PROPOSAL_SECTION_ADD_FAILED:     "Failed to add section.",
  PROPOSAL_SECTION_GENERATING:     "Generating content for new section...",
  PROPOSAL_APPROVED:               "Proposal approved and moved to history",
  PROPOSAL_REJECTED:               "Proposal rejected and moved to history",
  PROPOSAL_APPROVE_FAILED:         "Failed to approve proposal",
  PROPOSAL_REJECT_FAILED:          "Failed to reject proposal",
  PROPOSAL_DOWNLOADED:             "Proposal downloaded",
  PROPOSAL_DOWNLOAD_FAILED:        "Failed to download proposal",
  PROPOSAL_SECTION_NAME_EMPTY:         "Section name cannot be empty.",
  PROPOSAL_SECTION_NAME_EXISTS:        "A section with that name already exists.",
  PROPOSAL_MIN_SECTIONS:               "At least one section is required.",
  PROPOSAL_SECTIONS_REORDERED:         "Section order updated.",
  PROPOSAL_SECTIONS_REORDER_FAILED:    "Failed to update section order.",

  DRAFT_SAVED:       "Draft saved",
  DRAFT_RESTORED:    "Draft restored",
  DRAFT_DELETED:     "Draft deleted",
  DRAFT_ALL_DELETED: "All drafts deleted",

  UPLOAD_IN_PROGRESS:  "Uploading file\u2026",
  UPLOAD_SUCCESS:      "File uploaded",
  UPLOAD_FAILED:       "File upload failed. Please try again.",
  UPLOAD_TOO_LARGE:    "File is too large. Maximum size is 10 MB.",
  UPLOAD_INVALID_TYPE: "Invalid file type.",

  VALIDATION_REQUIRED:      "This field is required.",
  VALIDATION_EMAIL:         "Please enter a valid email address.",
  VALIDATION_MIN_LENGTH:    (min: number): string => `Must be at least ${min} characters.`,
  VALIDATION_MAX_LENGTH:    (max: number): string => `Must be no more than ${max} characters.`,
  VALIDATION_PASSWORD_WEAK: "Password must be at least 8 characters and contain a number.",
} as const;
