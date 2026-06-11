/**
 * Tests for src/store/features/auth/authSlice.ts
 */

jest.mock("@/utils/auth", () => ({
  setAccessToken: jest.fn(),
  clearTokens: jest.fn(),
}));

import { useAuthStore } from "@/store/features/auth/authSlice";
import * as authUtils from "@/utils/auth";
import type { AuthUser } from "@/interfaces/authInterfaces";

const mockSetAccessToken = authUtils.setAccessToken as jest.Mock;
const mockClearTokens = authUtils.clearTokens as jest.Mock;

const mockUser: AuthUser = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
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
// Initial state
// ---------------------------------------------------------------------------

describe("authSlice — initial state", () => {
  it("user is null", () => expect(useAuthStore.getState().user).toBeNull());
  it("isAuthenticated is false", () => expect(useAuthStore.getState().isAuthenticated).toBe(false));
  it("isLoading is false", () => expect(useAuthStore.getState().isLoading).toBe(false));
  it("error is null", () => expect(useAuthStore.getState().error).toBeNull());
});

// ---------------------------------------------------------------------------
// setUser
// ---------------------------------------------------------------------------

describe("authSlice — setUser", () => {
  it("stores user and marks authenticated", () => {
    useAuthStore.getState().setUser(mockUser, "access-token-123");
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it("clears any existing error", () => {
    useAuthStore.setState({ error: "some error" });
    useAuthStore.getState().setUser(mockUser, "token");
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("calls setAccessToken with the provided token", () => {
    useAuthStore.getState().setUser(mockUser, "my-token");
    expect(mockSetAccessToken).toHaveBeenCalledWith("my-token");
  });
});

// ---------------------------------------------------------------------------
// clearAuth
// ---------------------------------------------------------------------------

describe("authSlice — clearAuth", () => {
  it("clears user and marks unauthenticated", () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("calls clearTokens", () => {
    useAuthStore.getState().clearAuth();
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("clears error state", () => {
    useAuthStore.setState({ error: "expired" });
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setLoading
// ---------------------------------------------------------------------------

describe("authSlice — setLoading", () => {
  it("sets isLoading to true", () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });

  it("sets isLoading to false", () => {
    useAuthStore.setState({ isLoading: true });
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setError
// ---------------------------------------------------------------------------

describe("authSlice — setError", () => {
  it("sets error message", () => {
    useAuthStore.getState().setError("Invalid credentials");
    expect(useAuthStore.getState().error).toBe("Invalid credentials");
  });

  it("resets isLoading to false when error is set", () => {
    useAuthStore.setState({ isLoading: true });
    useAuthStore.getState().setError("error");
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("clears error when null is passed", () => {
    useAuthStore.setState({ error: "something" });
    useAuthStore.getState().setError(null);
    expect(useAuthStore.getState().error).toBeNull();
  });
});
