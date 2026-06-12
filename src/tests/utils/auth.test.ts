/**
 * Tests for src/utils/auth.ts
 *
 * Note: getAccessToken, setAccessToken, clearTokens use sessionStorage.
 * isTokenExpired and getTokenPayload decode JWT payloads.
 */

import {
  getAccessToken,
  setAccessToken,
  clearTokens,
  isTokenExpired,
  getTokenPayload,
} from "@/utils/auth";

// ---------------------------------------------------------------------------
// Helpers — build a fake JWT
// ---------------------------------------------------------------------------

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = "fake-signature";
  return `${header}.${body}.${sig}`;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// getAccessToken
// ---------------------------------------------------------------------------

describe("getAccessToken", () => {
  it("returns null when no token is stored", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("returns stored token", () => {
    sessionStorage.setItem("draftora_access_token", "my-token");
    expect(getAccessToken()).toBe("my-token");
  });
});

// ---------------------------------------------------------------------------
// setAccessToken
// ---------------------------------------------------------------------------

describe("setAccessToken", () => {
  it("stores the token in sessionStorage", () => {
    setAccessToken("test-token-123");
    expect(sessionStorage.getItem("draftora_access_token")).toBe("test-token-123");
  });

  it("overwrites existing token", () => {
    setAccessToken("old-token");
    setAccessToken("new-token");
    expect(sessionStorage.getItem("draftora_access_token")).toBe("new-token");
  });
});

// ---------------------------------------------------------------------------
// clearTokens
// ---------------------------------------------------------------------------

describe("clearTokens", () => {
  it("removes the access token from sessionStorage", () => {
    sessionStorage.setItem("draftora_access_token", "token-to-remove");
    clearTokens();
    expect(sessionStorage.getItem("draftora_access_token")).toBeNull();
  });

  it("is a no-op when no token is set", () => {
    expect(() => clearTokens()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// isTokenExpired
// ---------------------------------------------------------------------------

describe("isTokenExpired", () => {
  it("returns false for a non-expired token", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const token = makeJwt({ exp: futureExp, sub: "user1" });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns true for an expired token", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const token = makeJwt({ exp: pastExp });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true when exp is missing", () => {
    const token = makeJwt({ sub: "user1" }); // no exp
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true for an invalid token string", () => {
    expect(isTokenExpired("not.a.token")).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(isTokenExpired("")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTokenPayload
// ---------------------------------------------------------------------------

describe("getTokenPayload", () => {
  it("returns the decoded payload", () => {
    const payload = { sub: "user123", role: "admin", exp: 9999999999 };
    const token = makeJwt(payload);
    const result = getTokenPayload<typeof payload>(token);
    expect(result?.sub).toBe("user123");
    expect(result?.role).toBe("admin");
  });

  it("returns null for an invalid token", () => {
    expect(getTokenPayload("invalid")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getTokenPayload("")).toBeNull();
  });

  it("returns null for malformed payload segment", () => {
    expect(getTokenPayload("header.not-base64.sig")).toBeNull();
  });
});
