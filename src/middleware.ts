/**
 * Next.js Middleware — Server-side route protection
 *
 * Prevents unauthenticated users from accessing protected routes at the
 * network level, before any page HTML is rendered.
 *
 * Note: Locale routing is handled automatically by next-intl via next.config.mjs
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
import { locales, defaultLocale, type Locale } from "@/i18n/config";

const SESSION_COOKIE_NAME =
  process.env.DRAFTORA_SESSION_COOKIE ?? "draftora_session";

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

/**
 * Routes that require an active session.
 * All other routes (/, /login, public assets) are unrestricted.
 * Note: These patterns include locale prefixes (e.g., /en, /es)
 */
const PROTECTED_ROUTE_PATTERNS: RegExp[] = [
  /^\/(en|es)\/dashboard/,
  /^\/(en|es)\/parameters/,
  /^\/(en|es)\/review/,
  /^\/(en|es)\/proposal\/.+/,
  /^\/(en|es)\/generating/,
  /^\/(en|es)\/drafts/,
  /^\/(en|es)\/clients/,
  /^\/(en|es)\/history/,
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  if (isProtectedRoute(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

    if (!sessionCookie && AUTH_ENABLED) {
      const locale = pathname.split('/')[1] || defaultLocale;
      const validLocale = locales.includes(locale as Locale) ? locale : defaultLocale;
      const loginUrl = new URL(`/${validLocale}/login`, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!sessionCookie) {
      // Audit-only mode: attach header
      const response = NextResponse.next();
      response.headers.set("x-draftora-unauthenticated", "1");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
