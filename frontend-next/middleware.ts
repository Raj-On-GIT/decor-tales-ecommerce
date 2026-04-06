import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAMES = ["access_token", "refresh_token"];

function hasSessionCookie(request: NextRequest) {
  // Treat either auth cookie as an active session signal.
  // The backend still remains the source of truth for real authorization.
  return AUTH_COOKIE_NAMES.some((cookieName) =>
    Boolean(request.cookies.get(cookieName)?.value),
  );
}

export function middleware(request: NextRequest) {
  // Only protect the matched route groups below, so public pages remain untouched.
  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const requestedPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  // Preserve the destination for post-login navigation without creating loops.
  loginUrl.searchParams.set("next", requestedPath);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/account/:path*", "/orders/:path*", "/checkout/:path*"],
};
