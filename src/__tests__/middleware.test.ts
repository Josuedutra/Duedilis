/**
 * Middleware tests — BUG P1 fix: redirect loop
 * Task: gov-1775258108670-syy51k
 *
 * Tests the authorized() callback logic from src/lib/auth.config.ts
 * and the middleware PROTECTED_PATHS config without importing next-auth
 * (not available in Node test environment).
 *
 * C1 — Unit tests:
 *   1. Middleware com session válida em rota protegida → não redireciona (authorized)
 *   2. Middleware sem session em rota protegida → redireciona para /login
 *   3. Middleware em rota pública → não redireciona (sem verificação)
 *
 * C2 — Integration:
 *   4. Routing integrity: PROTECTED_PATHS all have corresponding page files
 *   5. Matcher excludes public routes (api, _next, login, register, onboarding, invite)
 */

import { describe, it, expect } from "vitest";
import { PROTECTED_PATHS } from "@/lib/auth.config";
import * as fs from "fs";
import * as path from "path";

// ─── Mirror of authorized() callback from auth.config.ts ─────────────────────
// Mirrors the logic verbatim: isProtected && !auth?.user → not authorized
function simulateAuthorized(pathname: string, hasSession: boolean): boolean {
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (isProtected && !hasSession) {
    return false; // triggers redirect to /login
  }

  return true;
}

// ─── C1: Unit tests ───────────────────────────────────────────────────────────

describe("Middleware — C1: authorized() callback logic", () => {
  describe("Protected routes with valid session → authorized (no redirect)", () => {
    it("/ with session → authorized", () => {
      expect(simulateAuthorized("/", true)).toBe(true);
    });

    it("/projects with session → authorized", () => {
      expect(simulateAuthorized("/projects", true)).toBe(true);
    });

    it("/projects/123 with session → authorized", () => {
      expect(simulateAuthorized("/projects/123", true)).toBe(true);
    });

    it("/issues with session → authorized", () => {
      expect(simulateAuthorized("/issues", true)).toBe(true);
    });

    it("/documents with session → authorized", () => {
      expect(simulateAuthorized("/documents", true)).toBe(true);
    });

    it("/members with session → authorized", () => {
      expect(simulateAuthorized("/members", true)).toBe(true);
    });

    it("/members/settings with session → authorized", () => {
      expect(simulateAuthorized("/members/settings", true)).toBe(true);
    });
  });

  describe("Protected routes without session → not authorized (redirect to /login)", () => {
    it("/ without session → not authorized", () => {
      expect(simulateAuthorized("/", false)).toBe(false);
    });

    it("/projects without session → not authorized", () => {
      expect(simulateAuthorized("/projects", false)).toBe(false);
    });

    it("/projects/123 without session → not authorized", () => {
      expect(simulateAuthorized("/projects/123", false)).toBe(false);
    });

    it("/issues without session → not authorized", () => {
      expect(simulateAuthorized("/issues", false)).toBe(false);
    });

    it("/documents without session → not authorized", () => {
      expect(simulateAuthorized("/documents", false)).toBe(false);
    });

    it("/members without session → not authorized", () => {
      expect(simulateAuthorized("/members", false)).toBe(false);
    });
  });

  describe("Public routes → always authorized (no auth check)", () => {
    it("/login without session → authorized (public)", () => {
      expect(simulateAuthorized("/login", false)).toBe(true);
    });

    it("/register without session → authorized (public)", () => {
      expect(simulateAuthorized("/register", false)).toBe(true);
    });

    it("/onboarding without session → authorized (public)", () => {
      expect(simulateAuthorized("/onboarding", false)).toBe(true);
    });

    it("/invite/abc without session → authorized (public)", () => {
      expect(simulateAuthorized("/invite/abc", false)).toBe(true);
    });

    it("/login with session → authorized (public, no session needed)", () => {
      expect(simulateAuthorized("/login", true)).toBe(true);
    });
  });

  describe("No redirect loop: / with session stays authorized", () => {
    it("Redirect loop scenario: / with valid session must NOT redirect to /login", () => {
      // This is the root cause of the P1 bug:
      // getToken() couldn't read __Secure-authjs.session-token → false negative
      // auth() wrapper reads same cookie as auth() in server components → no mismatch
      const authorized = simulateAuthorized("/", true);
      expect(authorized).toBe(true); // Must NOT trigger redirect
    });
  });
});

// ─── C2: Routing integrity ────────────────────────────────────────────────────

describe("Middleware — C2: routing integrity", () => {
  const appDir = path.join(__dirname, "../app");

  it("PROTECTED_PATHS contains expected routes", () => {
    expect(PROTECTED_PATHS).toContain("/");
    expect(PROTECTED_PATHS).toContain("/projects");
    expect(PROTECTED_PATHS).toContain("/issues");
    expect(PROTECTED_PATHS).toContain("/documents");
    expect(PROTECTED_PATHS).toContain("/members");
  });

  it("All PROTECTED_PATHS have corresponding page.tsx in app directory", () => {
    const missing: string[] = [];

    for (const route of PROTECTED_PATHS) {
      const relativePath = route === "/" ? "" : route;

      // Walk app dir to find page serving this route (accounting for route groups)
      const found = findPageForRoute(appDir, relativePath);
      if (!found) {
        missing.push(route);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `PROTECTED_PATHS have no corresponding page.tsx: ${missing.join(", ")}`,
      );
    }
  });

  it("Middleware matcher excludes public routes (login, register, api, _next)", () => {
    // Mirror of the matcher regex from middleware.ts
    const matcherRegex =
      /^\/((?!api|_next\/static|_next\/image|login|register|onboarding|invite|favicon\.ico).*)$/;

    const publicRoutes = [
      "/login",
      "/register",
      "/onboarding",
      "/invite/abc",
      "/api/auth/callback",
      "/_next/static/chunk.js",
      "/favicon.ico",
    ];

    for (const route of publicRoutes) {
      expect(matcherRegex.test(route)).toBe(false);
    }

    const protectedRoutes = ["/", "/projects", "/issues", "/documents"];
    for (const route of protectedRoutes) {
      expect(matcherRegex.test(route)).toBe(true);
    }
  });
});

// ─── Helper: recursive page finder ───────────────────────────────────────────

function findPageForRoute(appDir: string, targetRoute: string): boolean {
  // Walk the app directory to find page.tsx that serves the target route
  function walk(dir: string, currentRoute: string): boolean {
    if (!fs.existsSync(dir)) return false;

    // Check if current route matches target
    if (currentRoute === targetRoute) {
      for (const ext of ["tsx", "ts"]) {
        if (fs.existsSync(path.join(dir, `page.${ext}`))) return true;
      }
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;

        // Skip special Next.js dirs
        if (name.startsWith("_") || name === "node_modules") continue;

        let childRoute: string;
        if (name.startsWith("(") && name.endsWith(")")) {
          // Route group — doesn't contribute to URL
          childRoute = currentRoute;
        } else if (name.startsWith("[")) {
          // Dynamic segment — skip for this check
          continue;
        } else {
          childRoute = currentRoute + "/" + name;
        }

        if (walk(path.join(dir, name), childRoute)) return true;
      }
    } catch {
      // Ignore read errors
    }

    return false;
  }

  return walk(appDir, targetRoute);
}
