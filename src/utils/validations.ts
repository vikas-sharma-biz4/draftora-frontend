/**
 * Reusable field-level validation helpers
 *
 * Each function returns a boolean — combine them in validation schemas
 * (src/validationSchema/) to build full form validators.
 */

export function isRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function isEmail(value: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());
}

export function isMinLength(value: string, min: number): boolean {
  return value.trim().length >= min;
}

export function isMaxLength(value: string, max: number): boolean {
  return value.trim().length <= max;
}

export function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isNumeric(value: string): boolean {
  return !isNaN(Number(value)) && value.trim() !== "";
}

export function isPasswordStrong(value: string): boolean {
  return value.length >= 8 && /[a-zA-Z]/.test(value) && /[0-9]/.test(value);
}

export function isMatch(value: string, compareTo: string): boolean {
  return value === compareTo;
}

export type FieldError = string | null;

export function validate(
  value: unknown,
  rules: Array<(v: unknown) => FieldError>
): FieldError {
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return null;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
