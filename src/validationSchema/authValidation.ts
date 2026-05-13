import {
  isRequired,
  isEmail,
  isMinLength,
  isPasswordStrong,
  hasErrors,
} from "@/utils/validations";
import { MESSAGES } from "@/constants/messages";

export interface LoginFields {
  email:    string;
  password: string;
}
export interface LoginErrors {
  email?:    string;
  password?: string;
}

export function validateLogin(fields: LoginFields): LoginErrors {
  const errors: LoginErrors = {};

  if (!isRequired(fields.email)) {
    errors.email = MESSAGES.VALIDATION_REQUIRED;
  } else if (!isEmail(fields.email)) {
    errors.email = MESSAGES.VALIDATION_EMAIL;
  }

  if (!isRequired(fields.password)) {
    errors.password = MESSAGES.VALIDATION_REQUIRED;
  }

  return errors;
}

export interface RegisterFields {
  name:            string;
  email:           string;
  password:        string;
  confirmPassword: string;
}
export interface RegisterErrors {
  name?:            string;
  email?:           string;
  password?:        string;
  confirmPassword?: string;
}

export function validateRegister(fields: RegisterFields): RegisterErrors {
  const errors: RegisterErrors = {};

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

  if (!isRequired(fields.password)) {
    errors.password = MESSAGES.VALIDATION_REQUIRED;
  } else if (!isPasswordStrong(fields.password)) {
    errors.password = MESSAGES.VALIDATION_PASSWORD_WEAK;
  }

  if (!isRequired(fields.confirmPassword)) {
    errors.confirmPassword = MESSAGES.VALIDATION_REQUIRED;
  } else if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export { hasErrors };
