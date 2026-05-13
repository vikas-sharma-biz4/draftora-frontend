import {
  isRequired,
  isEmail,
  isMinLength,
  isPasswordStrong,
  hasErrors,
} from "@/utils/validations";
import { MESSAGES } from "@/constants/messages";

export interface ProfileFields {
  name:  string;
  email: string;
}
export interface ProfileErrors {
  name?:  string;
  email?: string;
}

export function validateProfile(fields: ProfileFields): ProfileErrors {
  const errors: ProfileErrors = {};

  if (!isRequired(fields.name)) {
    errors.name = MESSAGES.VALIDATION_REQUIRED;
  } else if (!isMinLength(fields.name, 2)) {
    errors.name = MESSAGES.VALIDATION_MIN_LENGTH(2);
  }

  if (!isRequired(fields.email)) {
    errors.email = MESSAGES.VALIDATION_REQUIRED;
  } else if (!isEmail(fields.email)) {
    errors.email = MESSAGES.VALIDATION_EMAIL;
  }

  return errors;
}

export interface PasswordChangeFields {
  currentPassword: string;
  newPassword:     string;
  confirmPassword: string;
}
export interface PasswordChangeErrors {
  currentPassword?: string;
  newPassword?:     string;
  confirmPassword?: string;
}

export function validatePasswordChange(
  fields: PasswordChangeFields
): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};

  if (!isRequired(fields.currentPassword)) {
    errors.currentPassword = MESSAGES.VALIDATION_REQUIRED;
  }

  if (!isRequired(fields.newPassword)) {
    errors.newPassword = MESSAGES.VALIDATION_REQUIRED;
  } else if (!isPasswordStrong(fields.newPassword)) {
    errors.newPassword = MESSAGES.VALIDATION_PASSWORD_WEAK;
  }

  if (!isRequired(fields.confirmPassword)) {
    errors.confirmPassword = MESSAGES.VALIDATION_REQUIRED;
  } else if (fields.newPassword !== fields.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export { hasErrors };
