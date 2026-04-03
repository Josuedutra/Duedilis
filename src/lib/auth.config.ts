/**
 * Edge-safe NextAuth configuration.
 * Used by middleware.ts — MUST NOT import Prisma, PrismaAdapter, or bcryptjs
 * (those are Node.js-only and exceed the Edge Function bundle limit).
 *
 * The full config (with PrismaAdapter + bcryptjs) lives in src/lib/auth.ts
 * and is used by server components and API routes.
 */
import type { NextAuthConfig } from "next-auth";

// Routes that require authentication
export const PROTECTED_PATHS = [
  "/",
  "/projects",
  "/issues",
  "/documents",
  "/members",
];

const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      const isProtected = PROTECTED_PATHS.some(
        (path) => pathname === path || pathname.startsWith(path + "/"),
      );

      if (isProtected && !auth?.user) {
        return false; // triggers redirect to pages.signIn
      }

      return true;
    },
  },
};

export default authConfig;
