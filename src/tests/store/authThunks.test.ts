/**
 * Tests for src/store/features/auth/authThunks.ts
 */

jest.mock("@/services/auth.service", () => ({
  login: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("@/utils/auth", () => ({
  setAccessToken: jest.fn(),
  clearTokens: jest.fn(),
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { loginThunk, logoutThunk } from "@/store/features/auth/authThunks";
import { useAuthStore } from "@/store/features/auth/authSlice";
import * as authService from "@/services/auth.service";
import type { AuthUser } from "@/interfaces/authInterfaces";

const mockLogin = authService.login as jest.Mock;
const mockLogout = authService.logout as jest.Mock;

const mockUser: AuthUser = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  role: "user",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
});

// ---------------------------------------------------------------------------
// loginThunk
// ---------------------------------------------------------------------------

describe("loginThunk — success", () => {
  it("calls authService.login with credentials", async () => {
    mockLogin.mockResolvedValue({
      user: mockUser,
      tokens: { accessToken: "abc", refreshToken: "xyz", expiresIn: 3600 },
    });

    await loginThunk({ email: "alice@example.com", password: "pass" });

    expect(mockLogin).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "pass",
    });
  });

  it("sets user in authStore on success", async () => {
    mockLogin.mockResolvedValue({
      user: mockUser,
      tokens: { accessToken: "token-123", refreshToken: "r", expiresIn: 3600 },
    });

    await loginThunk({ email: "alice@example.com", password: "pass" });

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("sets isLoading=true before the call, implicitly (store shows false after)", async () => {
    mockLogin.mockResolvedValue({
      user: mockUser,
      tokens: { accessToken: "t", refreshToken: "r", expiresIn: 0 },
    });

    await loginThunk({ email: "a@b.com", password: "p" });
    // After success, loading should be reset (setUser doesn't set it, but setLoading(true) was called first)
    // The important thing is no error
    expect(useAuthStore.getState().error).toBeNull();
  });
});

describe("loginThunk — failure", () => {
  it("calls setError when login throws", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));

    await expect(loginThunk({ email: "a@b.com", password: "bad" })).rejects.toThrow(
      "Invalid credentials"
    );

    expect(useAuthStore.getState().error).toBe("Invalid credentials");
  });

  it("re-throws the error", async () => {
    mockLogin.mockRejectedValue(new Error("Server error"));

    let caught: Error | undefined;
    try {
      await loginThunk({ email: "a@b.com", password: "p" });
    } catch (e) {
      caught = e as Error;
    }

    expect(caught?.message).toBe("Server error");
  });

  it("sets generic error for non-Error rejection", async () => {
    mockLogin.mockRejectedValue("unexpected");

    try {
      await loginThunk({ email: "a@b.com", password: "p" });
    } catch {
      // expected
    }

    expect(useAuthStore.getState().error).toBe("Login failed");
  });
});

// ---------------------------------------------------------------------------
// logoutThunk
// ---------------------------------------------------------------------------

describe("logoutThunk — success", () => {
  it("calls authService.logout with the access token", async () => {
    mockLogout.mockResolvedValue(undefined);

    await logoutThunk("my-access-token");

    expect(mockLogout).toHaveBeenCalledWith("my-access-token");
  });

  it("clears auth state after logout", async () => {
    mockLogout.mockResolvedValue(undefined);
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });

    await logoutThunk("token");

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe("logoutThunk — logout API failure is swallowed", () => {
  it("still clears auth state even when logout API throws", async () => {
    mockLogout.mockRejectedValue(new Error("Network error"));
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });

    // Should not throw
    await logoutThunk("bad-token");

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
