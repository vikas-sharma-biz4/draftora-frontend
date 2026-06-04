import { validateProposalBasic, hasErrors } from "@/validationSchema/proposalValidation";

const VALID_FIELDS = {
  title: "Valid Proposal Title",
  clientName: "Acme Corp",
  description: "A detailed description of what is needed.",
  tone: "professional",
  lengthPreference: "balanced",
  language: "en",
};

// ---------------------------------------------------------------------------
// validateProposalBasic — valid input
// ---------------------------------------------------------------------------

describe("validateProposalBasic — valid input", () => {
  it("returns no errors for valid fields", () => {
    expect(validateProposalBasic(VALID_FIELDS)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// title
// ---------------------------------------------------------------------------

describe("validateProposalBasic — title", () => {
  it("requires title", () => {
    const { title } = validateProposalBasic({ ...VALID_FIELDS, title: "" });
    expect(title).toBe("This field is required.");
  });

  it("rejects title shorter than 3 characters", () => {
    const { title } = validateProposalBasic({ ...VALID_FIELDS, title: "AB" });
    expect(title).toBe("Must be at least 3 characters.");
  });

  it("accepts title of exactly 3 characters", () => {
    const { title } = validateProposalBasic({ ...VALID_FIELDS, title: "ABC" });
    expect(title).toBeUndefined();
  });

  it("rejects title longer than 200 characters", () => {
    const { title } = validateProposalBasic({
      ...VALID_FIELDS,
      title: "A".repeat(201),
    });
    expect(title).toBe("Must be no more than 200 characters.");
  });

  it("accepts title of exactly 200 characters", () => {
    const { title } = validateProposalBasic({
      ...VALID_FIELDS,
      title: "A".repeat(200),
    });
    expect(title).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clientName
// ---------------------------------------------------------------------------

describe("validateProposalBasic — clientName", () => {
  it("requires clientName", () => {
    const { clientName } = validateProposalBasic({ ...VALID_FIELDS, clientName: "" });
    expect(clientName).toBe("This field is required.");
  });

  it("accepts non-empty clientName", () => {
    const { clientName } = validateProposalBasic({ ...VALID_FIELDS, clientName: "X" });
    expect(clientName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// description
// ---------------------------------------------------------------------------

describe("validateProposalBasic — description", () => {
  it("requires description", () => {
    const { description } = validateProposalBasic({ ...VALID_FIELDS, description: "" });
    expect(description).toBe("This field is required.");
  });

  it("rejects description shorter than 10 characters", () => {
    const { description } = validateProposalBasic({ ...VALID_FIELDS, description: "Short" });
    expect(description).toBe("Must be at least 10 characters.");
  });

  it("accepts description of exactly 10 characters", () => {
    const { description } = validateProposalBasic({ ...VALID_FIELDS, description: "1234567890" });
    expect(description).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// tone / lengthPreference / language
// ---------------------------------------------------------------------------

describe("validateProposalBasic — required select fields", () => {
  it("requires tone", () => {
    const { tone } = validateProposalBasic({ ...VALID_FIELDS, tone: "" });
    expect(tone).toBe("This field is required.");
  });

  it("requires lengthPreference", () => {
    const { lengthPreference } = validateProposalBasic({ ...VALID_FIELDS, lengthPreference: "" });
    expect(lengthPreference).toBe("This field is required.");
  });

  it("requires language", () => {
    const { language } = validateProposalBasic({ ...VALID_FIELDS, language: "" });
    expect(language).toBe("This field is required.");
  });
});

// ---------------------------------------------------------------------------
// hasErrors
// ---------------------------------------------------------------------------

describe("hasErrors (re-exported from proposalValidation)", () => {
  it("returns false for an error-free result", () => {
    const errors = validateProposalBasic(VALID_FIELDS) as Record<string, string | undefined>;
    expect(hasErrors(errors)).toBe(false);
  });

  it("returns true when at least one field has an error", () => {
    const errors = validateProposalBasic({ ...VALID_FIELDS, title: "" }) as Record<
      string,
      string | undefined
    >;
    expect(hasErrors(errors)).toBe(true);
  });
});
