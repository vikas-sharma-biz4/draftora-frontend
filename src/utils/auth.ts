/**
 * Authentication utility helpers
 *
 * Handles token storage, retrieval, and JWT inspection.
 * Uses sessionStorage for access tokens (cleared on tab close).
 *
 * SECURITY: Refresh tokens are stored in httpOnly, Secure, SameSite=Strict cookies
 * set by the backend via Set-Cookie response header. The frontend never reads or
 * stores refresh tokens directly - the browser automatically attaches the cookie
 * to same-origin requests. This prevents XSS attacks from stealing refresh tokens.
 */

const ACCESS_TOKEN_KEY  = "draftora_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

function decodeBase64Url(base64url: string): string {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  return atob(padded);
}

export function isTokenExpired(token: string): boolean {
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(decodeBase64Url(payload)) as { exp?: number };
    if (!decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
}

export function getTokenPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(decodeBase64Url(payload)) as T;
  } catch {
    return null;
  }
}
