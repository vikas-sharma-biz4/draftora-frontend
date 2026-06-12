/**
 * Tests for src/services/auth.service.ts
 */

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/config/httpClient", () => ({
  http: {
    post: jest.fn(),
  },
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import {
  login,
  logout,
  refreshAccessToken,
  requestPasswordReset,
  confirmPasswordReset,
} from "@/services/auth.service";
import { http } from "@/config/httpClient";

const mockPost = (http as { post: jest.Mock }).post;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
};

const mockTokens = { accessToken: "access-123", expiresIn: 3600 };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe("auth.service — login", () => {
  it("calls http.post /auth/login with credentials", async () => {
    mockPost.mockResolvedValue({ user: mockUser, tokens: mockTokens });
    await login({ email: "alice@example.com", password: "pass" });
    expect(mockPost).toHaveBeenCalledWith(
      "/auth/login",
      { email: "alice@example.com", password: "pass" },
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("returns user and tokens", async () => {
    mockPost.mockResolvedValue({ user: mockUser, tokens: mockTokens });
    const result = await login({ email: "alice@example.com", password: "pass" });
    expect(result.user).toEqual(mockUser);
    expect(result.tokens.accessToken).toBe("access-123");
  });

  it("propagates errors", async () => {
    mockPost.mockRejectedValue(new Error("Invalid credentials"));
    await expect(login({ email: "a@b.com", password: "bad" })).rejects.toThrow(
      "Invalid credentials"
    );
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe("auth.service — logout", () => {
  it("calls http.post /auth/logout with Authorization header", async () => {
    mockPost.mockResolvedValue(null);
    await logout("my-token");
    expect(mockPost).toHaveBeenCalledWith(
      "/auth/logout",
      undefined,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
        credentials: "include",
      })
    );
  });

  it("returns void on success", async () => {
    mockPost.mockResolvedValue(null);
    await expect(logout("token")).resolves.toBeUndefined();
  });

  it("propagates errors", async () => {
    mockPost.mockRejectedValue(new Error("Unauthorized"));
    await expect(logout("bad-token")).rejects.toThrow("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe("auth.service — refreshAccessToken", () => {
  it("calls http.post /auth/refresh with credentials include", async () => {
    mockPost.mockResolvedValue(mockTokens);
    await refreshAccessToken();
    expect(mockPost).toHaveBeenCalledWith(
      "/auth/refresh",
      undefined,
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("returns new tokens", async () => {
    mockPost.mockResolvedValue(mockTokens);
    const result = await refreshAccessToken();
    expect(result.accessToken).toBe("access-123");
  });

  it("propagates errors", async () => {
    mockPost.mockRejectedValue(new Error("Refresh token expired"));
    await expect(refreshAccessToken()).rejects.toThrow("Refresh token expired");
  });
});

// ---------------------------------------------------------------------------
// requestPasswordReset
// ---------------------------------------------------------------------------

describe("auth.service — requestPasswordReset", () => {
  it("calls http.post /auth/forgot-password with email", async () => {
    mockPost.mockResolvedValue(null);
    await requestPasswordReset("alice@example.com");
    expect(mockPost).toHaveBeenCalledWith("/auth/forgot-password", {
      email: "alice@example.com",
    });
  });

  it("returns void on success", async () => {
    mockPost.mockResolvedValue(null);
    await expect(requestPasswordReset("a@b.com")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// confirmPasswordReset
// ---------------------------------------------------------------------------

describe("auth.service — confirmPasswordReset", () => {
  it("calls http.post /auth/reset-password with token and newPassword", async () => {
    mockPost.mockResolvedValue(null);
    await confirmPasswordReset("reset-token-123", "newPass456");
    expect(mockPost).toHaveBeenCalledWith("/auth/reset-password", {
      token: "reset-token-123",
      newPassword: "newPass456",
    });
  });

  it("returns void on success", async () => {
    mockPost.mockResolvedValue(null);
    await expect(confirmPasswordReset("t", "p")).resolves.toBeUndefined();
  });

  it("propagates errors", async () => {
    mockPost.mockRejectedValue(new Error("Token expired"));
    await expect(confirmPasswordReset("bad", "pass")).rejects.toThrow("Token expired");
  });
});
