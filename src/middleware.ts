export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/", "/projects", "/issues", "/documents", "/members"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

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
    "/((?!api|_next/static|_next/image|login|register|onboarding|invite|favicon.ico).*)",
  ],
};
