import {
  isRequired,
  isMinLength,
  isMaxLength,
  hasErrors,
} from "@/utils/validations";
import { MESSAGES } from "@/constants/messages";

export interface ProposalBasicFields {
  title:            string;
  clientName:       string;
  description:      string;
  tone:             string;
  lengthPreference: string;
  language:         string;
}
export interface ProposalBasicErrors {
  title?:            string;
  clientName?:       string;
  description?:      string;
  tone?:             string;
  lengthPreference?: string;
  language?:         string;
}

export function validateProposalBasic(fields: ProposalBasicFields): ProposalBasicErrors {
  const errors: ProposalBasicErrors = {};

  if (!isRequired(fields.title)) {
    errors.title = MESSAGES.VALIDATION_REQUIRED;
  } else if (!isMinLength(fields.title, 3)) {
    errors.title = MESSAGES.VALIDATION_MIN_LENGTH(3);
  } else if (!isMaxLength(fields.title, 200)) {
    errors.title = MESSAGES.VALIDATION_MAX_LENGTH(200);
  }

  if (!isRequired(fields.clientName)) {
    errors.clientName = MESSAGES.VALIDATION_REQUIRED;
  }

  if (!isRequired(fields.description)) {
    errors.description = MESSAGES.VALIDATION_REQUIRED;
  } else if (!isMinLength(fields.description, 10)) {
    errors.description = MESSAGES.VALIDATION_MIN_LENGTH(10);
  }

  if (!isRequired(fields.tone)) {
    errors.tone = MESSAGES.VALIDATION_REQUIRED;
  }

  if (!isRequired(fields.lengthPreference)) {
    errors.lengthPreference = MESSAGES.VALIDATION_REQUIRED;
  }

  if (!isRequired(fields.language)) {
    errors.language = MESSAGES.VALIDATION_REQUIRED;
  }

  return errors;
}

export { hasErrors };
