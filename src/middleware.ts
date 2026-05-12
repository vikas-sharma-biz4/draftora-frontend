/**
 * Next.js Middleware — Server-side route protection
 *
 * Prevents unauthenticated users from accessing protected routes at the
 * network level, before any page HTML is rendered. This closes the gap
 * left by client-side guards (useRouteGuard) which only fire after
 * the page has already been served.
 *
 * Auth model:
 * - Access tokens are stored in sessionStorage (client-only, not readable here).
 * - Refresh tokens are stored in httpOnly cookies set by the backend.
 * - This middleware checks for the presence of the refresh token cookie
 *   as proof of an active session.
 *
 * Configuration:
 * - AUTH_ENABLED env var: Set to "true" to enforce redirects.
 *   Until the auth backend is fully wired, the middleware runs in
 *   audit-only mode (logs but does not redirect).
 * - DRAFTORA_SESSION_COOKIE: Name of the httpOnly refresh token cookie
 *   set by the backend. Defaults to "draftora_session".
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME =
  process.env.DRAFTORA_SESSION_COOKIE ?? "draftora_session";

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

/**
 * Routes that require an active session.
 * All other routes (/, /login, public assets) are unrestricted.
 */
const PROTECTED_ROUTE_PATTERNS: RegExp[] = [
  /^\/dashboard/,
  /^\/parameters/,
  /^\/review/,
  /^\/proposal\/.+/,
  /^\/generating/,
  /^\/drafts/,
  /^\/clients/,
  /^\/history/,
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Only evaluate protected routes
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (sessionCookie) {
    // Session cookie present — allow request through
    return NextResponse.next();
  }

  // No session cookie — unauthenticated request to a protected route

  if (AUTH_ENABLED) {
    // Enforcement mode: redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Audit-only mode: allow through but attach a header
  // so client-side code can detect the unauthenticated state
  const response = NextResponse.next();
  response.headers.set("x-draftora-unauthenticated", "1");
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/parameters",
    "/review",
    "/proposal/:path*",
    "/generating/:path*",
    "/drafts",
    "/clients/:path*",
    "/history",
  ],
};
