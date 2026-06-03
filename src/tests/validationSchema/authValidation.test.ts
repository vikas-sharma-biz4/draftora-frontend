import { validateLogin, validateRegister, hasErrors } from "@/validationSchema/authValidation";

const VALID_LOGIN = { email: "user@example.com", password: "secret123" };
const VALID_REGISTER = {
  name: "Jane",
  email: "jane@example.com",
  password: "pass1234",
  confirmPassword: "pass1234",
};

// ---------------------------------------------------------------------------
// validateLogin
// ---------------------------------------------------------------------------

describe("validateLogin — valid input", () => {
  it("returns no errors for valid credentials", () => {
    expect(validateLogin(VALID_LOGIN)).toEqual({});
  });
});

describe("validateLogin — email", () => {
  it("requires email", () => {
    const { email } = validateLogin({ ...VALID_LOGIN, email: "" });
    expect(email).toBe("This field is required.");
  });

  it("requires email (whitespace only)", () => {
    const { email } = validateLogin({ ...VALID_LOGIN, email: "   " });
    expect(email).toBe("This field is required.");
  });

  it("rejects malformed email", () => {
    const { email } = validateLogin({ ...VALID_LOGIN, email: "notanemail" });
    expect(email).toBe("Please enter a valid email address.");
  });

  it("rejects email without TLD", () => {
    const { email } = validateLogin({ ...VALID_LOGIN, email: "user@nodot" });
    expect(email).toBe("Please enter a valid email address.");
  });
});

describe("validateLogin — password", () => {
  it("requires password", () => {
    const { password } = validateLogin({ ...VALID_LOGIN, password: "" });
    expect(password).toBe("This field is required.");
  });
});

// ---------------------------------------------------------------------------
// validateRegister
// ---------------------------------------------------------------------------

describe("validateRegister — valid input", () => {
  it("returns no errors for valid registration data", () => {
    expect(validateRegister(VALID_REGISTER)).toEqual({});
  });
});

describe("validateRegister — name", () => {
  it("requires name", () => {
    const { name } = validateRegister({ ...VALID_REGISTER, name: "" });
    expect(name).toBe("This field is required.");
  });

  it("rejects single-character name", () => {
    const { name } = validateRegister({ ...VALID_REGISTER, name: "A" });
    expect(name).toBe("Must be at least 2 characters.");
  });

  it("accepts two-character name", () => {
    const { name } = validateRegister({ ...VALID_REGISTER, name: "Jo" });
    expect(name).toBeUndefined();
  });
});

describe("validateRegister — email", () => {
  it("requires email", () => {
    const { email } = validateRegister({ ...VALID_REGISTER, email: "" });
    expect(email).toBe("This field is required.");
  });

  it("rejects invalid email format", () => {
    const { email } = validateRegister({ ...VALID_REGISTER, email: "bad-email" });
    expect(email).toBe("Please enter a valid email address.");
  });
});

describe("validateRegister — password", () => {
  it("requires password", () => {
    const { password } = validateRegister({ ...VALID_REGISTER, password: "", confirmPassword: "" });
    expect(password).toBe("This field is required.");
  });

  it("rejects weak password (letters only)", () => {
    const { password } = validateRegister({
      ...VALID_REGISTER,
      password: "onlyletters",
      confirmPassword: "onlyletters",
    });
    expect(password).toBe("Password must be at least 8 characters and contain a number.");
  });

  it("rejects weak password (too short)", () => {
    const { password } = validateRegister({
      ...VALID_REGISTER,
      password: "ab1",
      confirmPassword: "ab1",
    });
    expect(password).toBe("Password must be at least 8 characters and contain a number.");
  });

  it("accepts strong password (8+ chars with letter + number)", () => {
    const { password } = validateRegister({
      ...VALID_REGISTER,
      password: "secure12",
      confirmPassword: "secure12",
    });
    expect(password).toBeUndefined();
  });
});

describe("validateRegister — confirmPassword", () => {
  it("requires confirmPassword", () => {
    const { confirmPassword } = validateRegister({ ...VALID_REGISTER, confirmPassword: "" });
    expect(confirmPassword).toBe("This field is required.");
  });

  it("rejects mismatched passwords", () => {
    const { confirmPassword } = validateRegister({
      ...VALID_REGISTER,
      password: "pass1234",
      confirmPassword: "different1",
    });
    expect(confirmPassword).toBe("Passwords do not match.");
  });

  it("accepts matching passwords", () => {
    const { confirmPassword } = validateRegister({
      ...VALID_REGISTER,
      password: "match1234",
      confirmPassword: "match1234",
    });
    expect(confirmPassword).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// hasErrors
// ---------------------------------------------------------------------------

describe("hasErrors", () => {
  it("returns false when errors object is empty", () => {
    expect(hasErrors({})).toBe(false);
  });

  it("returns false when all error values are undefined", () => {
    expect(hasErrors({ email: undefined, password: undefined })).toBe(false);
  });

  it("returns true when any error is a non-empty string", () => {
    expect(hasErrors({ email: "This field is required." })).toBe(true);
  });

  it("returns true when only one field has an error", () => {
    expect(hasErrors({ email: undefined, password: "Required" })).toBe(true);
  });
});
