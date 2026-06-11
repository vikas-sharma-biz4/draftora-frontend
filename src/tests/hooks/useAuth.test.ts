/**
 * Tests for src/hooks/useAuth.ts
 */

jest.mock("@/store/features/auth/authSlice", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/store/features/auth/authThunks", () => ({
  loginThunk: jest.fn(),
  logoutThunk: jest.fn(),
}));

jest.mock("@/utils/auth", () => ({
  getAccessToken: jest.fn(),
}));

import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/features/auth/authSlice";
import { loginThunk, logoutThunk } from "@/store/features/auth/authThunks";
import { getAccessToken } from "@/utils/auth";

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockLoginThunk = loginThunk as jest.Mock;
const mockLogoutThunk = logoutThunk as jest.Mock;
const mockGetAccessToken = getAccessToken as jest.Mock;

const defaultAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuthStore.mockImplementation((selector) => {
    if (typeof selector === "function") {
      return selector(defaultAuthState);
    }
    return defaultAuthState;
  });
  mockGetAccessToken.mockReturnValue(null);
  mockLoginThunk.mockResolvedValue(undefined);
  mockLogoutThunk.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Return values
// ---------------------------------------------------------------------------

describe("useAuth — return values", () => {
  it("returns user from authStore", () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = { ...defaultAuthState, user: { id: 1, name: "Alice" } };
      return typeof selector === "function" ? selector(state) : state;
    });
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toEqual({ id: 1, name: "Alice" });
  });

  it("returns isAuthenticated from authStore", () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = { ...defaultAuthState, isAuthenticated: true };
      return typeof selector === "function" ? selector(state) : state;
    });
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("returns isLoading from authStore", () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = { ...defaultAuthState, isLoading: true };
      return typeof selector === "function" ? selector(state) : state;
    });
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(true);
  });

  it("returns error from authStore", () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = { ...defaultAuthState, error: "Auth failed" };
      return typeof selector === "function" ? selector(state) : state;
    });
    const { result } = renderHook(() => useAuth());
    expect(result.current.error).toBe("Auth failed");
  });

  it("returns accessToken from getAccessToken()", () => {
    mockGetAccessToken.mockReturnValue("my-access-token");
    const { result } = renderHook(() => useAuth());
    expect(result.current.accessToken).toBe("my-access-token");
  });

  it("returns null accessToken when no token stored", () => {
    mockGetAccessToken.mockReturnValue(null);
    const { result } = renderHook(() => useAuth());
    expect(result.current.accessToken).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe("useAuth — login", () => {
  it("calls loginThunk with email and password", async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.login("alice@example.com", "secret");
    });
    expect(mockLoginThunk).toHaveBeenCalledWith({ email: "alice@example.com", password: "secret" });
  });

  it("propagates login errors", async () => {
    mockLoginThunk.mockRejectedValue(new Error("Invalid credentials"));
    const { result } = renderHook(() => useAuth());
    await expect(
      act(async () => {
        await result.current.login("bad@test.com", "wrong");
      })
    ).rejects.toThrow("Invalid credentials");
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe("useAuth — logout", () => {
  it("calls logoutThunk with the current access token", async () => {
    mockGetAccessToken.mockReturnValue("bearer-token-xyz");
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.logout();
    });
    expect(mockLogoutThunk).toHaveBeenCalledWith("bearer-token-xyz");
  });

  it("calls logoutThunk with empty string when no token exists", async () => {
    mockGetAccessToken.mockReturnValue(null);
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.logout();
    });
    expect(mockLogoutThunk).toHaveBeenCalledWith("");
  });

  it("propagates logout errors", async () => {
    mockLogoutThunk.mockRejectedValue(new Error("Logout failed"));
    const { result } = renderHook(() => useAuth());
    await expect(
      act(async () => {
        await result.current.logout();
      })
    ).rejects.toThrow("Logout failed");
  });
});
