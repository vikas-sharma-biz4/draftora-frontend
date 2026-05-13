/**
 * Next.js Middleware — Server-side route protection and locale routing
 *
 * Prevents unauthenticated users from accessing protected routes at the
 * network level, before any page HTML is rendered. This closes the gap
 * left by client-side guards (useRouteGuard) which only fire after
 * the page has already been served.
 *
 * Also handles locale-based routing for i18n support using next-intl.
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
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/i18n/config";

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

// Create next-intl middleware for locale routing
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Apply locale routing first
  const intlResponse = intlMiddleware(request);

  // If intl middleware redirected, return that response
  if (intlResponse) {
    // Check if the redirected path is protected
    const redirectedUrl = intlResponse.headers.get('location') || pathname;
    if (isProtectedRoute(redirectedUrl)) {
      const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

      if (!sessionCookie && AUTH_ENABLED) {
        // Enforcement mode: redirect to login with locale
        const locale = pathname.startsWith('/') ? pathname.split('/')[1] : defaultLocale;
        const validLocale = locales.includes(locale as any) ? locale : defaultLocale;
        const loginUrl = new URL(`/${validLocale}/login`, request.url);
        loginUrl.searchParams.set("next", redirectedUrl);
        return NextResponse.redirect(loginUrl);
      }

      if (!sessionCookie) {
        // Audit-only mode: attach header
        intlResponse.headers.set("x-draftora-unauthenticated", "1");
      }
    }
    return intlResponse;
  }

  // Check auth for protected routes
  if (isProtectedRoute(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

    if (sessionCookie) {
      return NextResponse.next();
    }

    if (AUTH_ENABLED) {
      const locale = pathname.startsWith('/') ? pathname.split('/')[1] : defaultLocale;
      const validLocale = locales.includes(locale as any) ? locale : defaultLocale;
      const loginUrl = new URL(`/${validLocale}/login`, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const response = NextResponse.next();
    response.headers.set("x-draftora-unauthenticated", "1");
    return response;
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
