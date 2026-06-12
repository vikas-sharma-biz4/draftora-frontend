/**
 * Tests for src/utils/validations.ts
 */

import {
  isRequired,
  isEmail,
  isMinLength,
  isMaxLength,
  isUrl,
  isNumeric,
  isPasswordStrong,
  isMatch,
  validate,
  hasErrors,
  type FieldError,
} from "@/utils/validations";

// ---------------------------------------------------------------------------
// isRequired
// ---------------------------------------------------------------------------

describe("isRequired", () => {
  it("returns false for null", () => expect(isRequired(null)).toBe(false));
  it("returns false for undefined", () => expect(isRequired(undefined)).toBe(false));
  it("returns false for empty string", () => expect(isRequired("")).toBe(false));
  it("returns false for whitespace string", () => expect(isRequired("   ")).toBe(false));
  it("returns false for empty array", () => expect(isRequired([])).toBe(false));
  it("returns true for non-empty string", () => expect(isRequired("hello")).toBe(true));
  it("returns true for non-empty array", () => expect(isRequired(["a"])).toBe(true));
  it("returns true for number", () => expect(isRequired(0)).toBe(true));
  it("returns true for object", () => expect(isRequired({})).toBe(true));
});

// ---------------------------------------------------------------------------
// isEmail
// ---------------------------------------------------------------------------

describe("isEmail", () => {
  it("returns true for valid email", () => expect(isEmail("user@example.com")).toBe(true));
  it("returns true for email with subdomains", () => expect(isEmail("a@b.co.uk")).toBe(true));
  it("returns false for missing @", () => expect(isEmail("userexample.com")).toBe(false));
  it("returns false for missing domain", () => expect(isEmail("user@")).toBe(false));
  it("returns false for empty string", () => expect(isEmail("")).toBe(false));
  it("returns true for email with +", () => expect(isEmail("user+tag@example.com")).toBe(true));
});

// ---------------------------------------------------------------------------
// isMinLength
// ---------------------------------------------------------------------------

describe("isMinLength", () => {
  it("returns true when length >= min", () => expect(isMinLength("hello", 3)).toBe(true));
  it("returns true when length == min", () => expect(isMinLength("hi", 2)).toBe(true));
  it("returns false when length < min", () => expect(isMinLength("a", 3)).toBe(false));
  it("trims before checking", () => expect(isMinLength("  ab  ", 2)).toBe(true));
});

// ---------------------------------------------------------------------------
// isMaxLength
// ---------------------------------------------------------------------------

describe("isMaxLength", () => {
  it("returns true when length <= max", () => expect(isMaxLength("hello", 10)).toBe(true));
  it("returns true when length == max", () => expect(isMaxLength("hello", 5)).toBe(true));
  it("returns false when length > max", () => expect(isMaxLength("toolong", 4)).toBe(false));
  it("trims before checking", () => expect(isMaxLength("  hi  ", 3)).toBe(true)); // trimmed "hi" = 2 chars ≤ 3
});

// ---------------------------------------------------------------------------
// isUrl
// ---------------------------------------------------------------------------

describe("isUrl", () => {
  it("returns true for http URL", () => expect(isUrl("http://example.com")).toBe(true));
  it("returns true for https URL", () => expect(isUrl("https://example.com/path")).toBe(true));
  it("returns false for plain text", () => expect(isUrl("not a url")).toBe(false));
  it("returns false for empty string", () => expect(isUrl("")).toBe(false));
  it("returns false for incomplete URL", () => expect(isUrl("example.com")).toBe(false));
});

// ---------------------------------------------------------------------------
// isNumeric
// ---------------------------------------------------------------------------

describe("isNumeric", () => {
  it("returns true for integer string", () => expect(isNumeric("42")).toBe(true));
  it("returns true for float string", () => expect(isNumeric("3.14")).toBe(true));
  it("returns false for non-numeric string", () => expect(isNumeric("abc")).toBe(false));
  it("returns false for empty string", () => expect(isNumeric("")).toBe(false));
  it("returns false for string with spaces only", () => expect(isNumeric("  ")).toBe(false));
  it("returns true for negative number", () => expect(isNumeric("-5")).toBe(true));
});

// ---------------------------------------------------------------------------
// isPasswordStrong
// ---------------------------------------------------------------------------

describe("isPasswordStrong", () => {
  it("returns true for strong password", () => expect(isPasswordStrong("Passw0rd")).toBe(true));
  it("returns false for too short", () => expect(isPasswordStrong("Abc1")).toBe(false));
  it("returns false for no digits", () => expect(isPasswordStrong("Password")).toBe(false));
  it("returns false for no letters", () => expect(isPasswordStrong("12345678")).toBe(false));
  it("returns true for exactly 8 chars with letters and digits", () =>
    expect(isPasswordStrong("abcd1234")).toBe(true));
});

// ---------------------------------------------------------------------------
// isMatch
// ---------------------------------------------------------------------------

describe("isMatch", () => {
  it("returns true when values match", () => expect(isMatch("abc", "abc")).toBe(true));
  it("returns false when values differ", () => expect(isMatch("abc", "def")).toBe(false));
  it("is case-sensitive", () => expect(isMatch("Abc", "abc")).toBe(false));
});

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

describe("validate", () => {
  const required = (v: unknown): FieldError => (!v ? "Required" : null);
  const minLen = (v: unknown): FieldError =>
    typeof v === "string" && v.length < 3 ? "Too short" : null;

  it("returns null when all rules pass", () => {
    expect(validate("hello", [required, minLen])).toBeNull();
  });

  it("returns first error when first rule fails", () => {
    expect(validate("", [required, minLen])).toBe("Required");
  });

  it("returns second error when only second rule fails", () => {
    expect(validate("ab", [required, minLen])).toBe("Too short");
  });

  it("returns null with empty rules array", () => {
    expect(validate("anything", [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasErrors
// ---------------------------------------------------------------------------

describe("hasErrors", () => {
  it("returns false when all values are falsy", () => {
    expect(hasErrors({ name: undefined, email: undefined })).toBe(false);
  });

  it("returns true when at least one value is truthy", () => {
    expect(hasErrors({ name: "Required", email: undefined })).toBe(true);
  });

  it("returns false for empty object", () => {
    expect(hasErrors({})).toBe(false);
  });

  it("returns true when error string is present", () => {
    expect(hasErrors({ field: "Invalid email" })).toBe(true);
  });
});
