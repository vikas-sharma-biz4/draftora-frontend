import {
  validateProfile,
  validatePasswordChange,
  hasErrors,
} from "@/validationSchema/settingsValidation";

// ---------------------------------------------------------------------------
// validateProfile
// ---------------------------------------------------------------------------

describe("validateProfile — valid input", () => {
  it("returns no errors for valid profile fields", () => {
    expect(validateProfile({ name: "Jane", email: "jane@example.com" })).toEqual({});
  });
});

describe("validateProfile — name", () => {
  it("requires name", () => {
    const { name } = validateProfile({ name: "", email: "jane@example.com" });
    expect(name).toBe("This field is required.");
  });

  it("rejects single-character name", () => {
    const { name } = validateProfile({ name: "A", email: "jane@example.com" });
    expect(name).toBe("Must be at least 2 characters.");
  });

  it("accepts two-character name", () => {
    const { name } = validateProfile({ name: "Jo", email: "jane@example.com" });
    expect(name).toBeUndefined();
  });
});

describe("validateProfile — email", () => {
  it("requires email", () => {
    const { email } = validateProfile({ name: "Jane", email: "" });
    expect(email).toBe("This field is required.");
  });

  it("rejects invalid email format", () => {
    const { email } = validateProfile({ name: "Jane", email: "not-an-email" });
    expect(email).toBe("Please enter a valid email address.");
  });

  it("accepts valid email", () => {
    const { email } = validateProfile({ name: "Jane", email: "valid@domain.com" });
    expect(email).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePasswordChange
// ---------------------------------------------------------------------------

const VALID_PASSWORD_CHANGE = {
  currentPassword: "oldpassword",
  newPassword: "newpass1",
  confirmPassword: "newpass1",
};

describe("validatePasswordChange — valid input", () => {
  it("returns no errors for valid password change", () => {
    expect(validatePasswordChange(VALID_PASSWORD_CHANGE)).toEqual({});
  });
});

describe("validatePasswordChange — currentPassword", () => {
  it("requires currentPassword", () => {
    const { currentPassword } = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      currentPassword: "",
    });
    expect(currentPassword).toBe("This field is required.");
  });
});

describe("validatePasswordChange — newPassword", () => {
  it("requires newPassword", () => {
    const { newPassword } = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      newPassword: "",
      confirmPassword: "",
    });
    expect(newPassword).toBe("This field is required.");
  });

  it("rejects weak newPassword (no number)", () => {
    const { newPassword } = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      newPassword: "onlyletters",
      confirmPassword: "onlyletters",
    });
    expect(newPassword).toBe("Password must be at least 8 characters and contain a number.");
  });

  it("rejects newPassword shorter than 8 characters", () => {
    const { newPassword } = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      newPassword: "ab1",
      confirmPassword: "ab1",
    });
    expect(newPassword).toBe("Password must be at least 8 characters and contain a number.");
  });

  it("accepts strong newPassword", () => {
    const { newPassword } = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      newPassword: "secure12",
      confirmPassword: "secure12",
    });
    expect(newPassword).toBeUndefined();
  });
});

describe("validatePasswordChange — confirmPassword", () => {
  it("requires confirmPassword", () => {
    const { confirmPassword } = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      confirmPassword: "",
    });
    expect(confirmPassword).toBe("This field is required.");
  });

  it("rejects mismatched confirmPassword", () => {
    const { confirmPassword } = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      newPassword: "newpass1",
      confirmPassword: "different1",
    });
    expect(confirmPassword).toBe("Passwords do not match.");
  });

  it("accepts matching confirmPassword", () => {
    const { confirmPassword } = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      newPassword: "match123",
      confirmPassword: "match123",
    });
    expect(confirmPassword).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// hasErrors
// ---------------------------------------------------------------------------

describe("hasErrors (re-exported from settingsValidation)", () => {
  it("returns false when all fields are valid", () => {
    const errors = validatePasswordChange(VALID_PASSWORD_CHANGE) as Record<
      string,
      string | undefined
    >;
    expect(hasErrors(errors)).toBe(false);
  });

  it("returns true when at least one field has an error", () => {
    const errors = validatePasswordChange({
      ...VALID_PASSWORD_CHANGE,
      currentPassword: "",
    }) as Record<string, string | undefined>;
    expect(hasErrors(errors)).toBe(true);
  });
});
