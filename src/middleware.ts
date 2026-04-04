export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/", "/projects", "/issues", "/documents", "/members"];

// NextAuth v5 session cookie names (both secure and non-secure variants)
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Handle /login: authenticated users go to dashboard; stale cookies get cleared
  if (pathname === "/login") {
    if (req.auth) {
      // Valid session — redirect authenticated user away from login page
      return NextResponse.redirect(new URL("/", req.url));
    }

    // No valid session — check if stale session cookies exist and clear them
    const hasStaleSessionCookie = SESSION_COOKIE_NAMES.some(
      (name) => req.cookies.get(name) !== undefined,
    );

    if (hasStaleSessionCookie) {
      // Stale cookie present but auth() returned null (invalid/expired token)
      // Clear all session cookies to prevent redirect loops on future requests
      const response = NextResponse.next();
      for (const cookieName of SESSION_COOKIE_NAMES) {
        if (req.cookies.get(cookieName) !== undefined) {
          response.cookies.set(cookieName, "", {
            maxAge: 0,
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
          });
        }
      }
      return response;
    }

    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|register|onboarding|invite|favicon.ico).*)",
  ],
};
