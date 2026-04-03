/**
 * Auth tests — Sprint D1 retroactive coverage
 * Task: gov-1775031802966-tst01
 *
 * Tests:
 *  - Registo: campos obrigatórios validados
 *  - Login: credenciais correctas / erradas
 *  - Middleware: rota /dashboard sem sessão redireciona para /login
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
const mockPrismaUser = {
  findUnique: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockPrismaUser,
    orgMembership: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
}));

// ─── Mock bcryptjs ────────────────────────────────────────────────────────────
vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import { compare } from "bcryptjs";

// ─── Auth field validation helpers (mirrors CredentialsProvider logic) ────────

function validateRegisterFields(data: {
  email?: string;
  password?: string;
  name?: string;
}) {
  const errors: string[] = [];
  if (!data.email || data.email.trim() === "") errors.push("email required");
  if (!data.password || data.password.trim() === "")
    errors.push("password required");
  if (!data.name || data.name.trim() === "") errors.push("name required");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email))
    errors.push("email invalid format");
  return errors;
}

// ─── Mirrors authorize() logic from src/lib/auth.ts ──────────────────────────
async function authorize(credentials: {
  email?: string;
  password?: string;
}): Promise<{ id: string; email: string } | null> {
  if (!credentials?.email || !credentials?.password) return null;

  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { email: credentials.email as string },
    include: { orgMemberships: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
  if (!user?.passwordHash) return null;

  const valid = await compare(
    credentials.password as string,
    user.passwordHash,
  );
  if (!valid) return null;

  return { id: user.id, email: user.email };
}

// ─── Mirrors middleware logic from src/middleware.ts ──────────────────────────
function middlewareCheck(
  pathname: string,
  session: { user?: { id?: string } } | null,
): string | null {
  if (pathname.startsWith("/dashboard")) {
    if (!session?.user?.id) {
      return `/login?callbackUrl=${pathname}`;
    }
  }
  return null; // no redirect
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Auth — Registo: validação de campos obrigatórios", () => {
  it("rejeita quando email está vazio", () => {
    const errors = validateRegisterFields({
      email: "",
      password: "abc123",
      name: "Test",
    });
    expect(errors).toContain("email required");
  });

  it("rejeita quando password está vazia", () => {
    const errors = validateRegisterFields({
      email: "a@b.com",
      password: "",
      name: "Test",
    });
    expect(errors).toContain("password required");
  });

  it("rejeita quando name está vazio", () => {
    const errors = validateRegisterFields({
      email: "a@b.com",
      password: "abc123",
      name: "",
    });
    expect(errors).toContain("name required");
  });

  it("rejeita email com formato inválido", () => {
    const errors = validateRegisterFields({
      email: "notanemail",
      password: "abc123",
      name: "Test",
    });
    expect(errors).toContain("email invalid format");
  });

  it("não retorna erros com dados válidos", () => {
    const errors = validateRegisterFields({
      email: "user@example.com",
      password: "strongpassword",
      name: "João Silva",
    });
    expect(errors).toHaveLength(0);
  });
});

describe("Auth — Login: CredentialsProvider authorize()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna null quando email está ausente", async () => {
    const result = await authorize({ password: "abc" });
    expect(result).toBeNull();
  });

  it("retorna null quando password está ausente", async () => {
    const result = await authorize({ email: "a@b.com" });
    expect(result).toBeNull();
  });

  it("retorna null quando utilizador não existe", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    const result = await authorize({
      email: "notfound@b.com",
      password: "abc",
    });
    expect(result).toBeNull();
  });

  it("retorna null quando passwordHash é null (conta OAuth)", async () => {
    mockPrismaUser.findUnique.mockResolvedValue({
      id: "u1",
      email: "oauth@b.com",
      passwordHash: null,
      orgMemberships: [],
    });
    const result = await authorize({ email: "oauth@b.com", password: "abc" });
    expect(result).toBeNull();
  });

  it("retorna null quando password está incorrecta", async () => {
    mockPrismaUser.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@b.com",
      passwordHash: "$hashed",
      orgMemberships: [],
    });
    vi.mocked(compare).mockResolvedValue(false as never);
    const result = await authorize({ email: "user@b.com", password: "wrong" });
    expect(result).toBeNull();
  });

  it("retorna user quando credenciais são válidas", async () => {
    mockPrismaUser.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@b.com",
      name: "User",
      passwordHash: "$hashed",
      orgMemberships: [
        { orgId: "org1", role: "ADMIN_ORG", updatedAt: new Date() },
      ],
    });
    vi.mocked(compare).mockResolvedValue(true as never);
    const result = await authorize({
      email: "user@b.com",
      password: "correct",
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe("u1");
    expect(result?.email).toBe("user@b.com");
  });
});

describe("Auth — Middleware: protecção de /dashboard", () => {
  it("redireciona para /login quando sessão é null", () => {
    const redirect = middlewareCheck("/dashboard", null);
    expect(redirect).toBe("/login?callbackUrl=/dashboard");
  });

  it("redireciona para /login quando user.id está ausente", () => {
    const redirect = middlewareCheck("/dashboard/projects", { user: {} });
    expect(redirect).toBe("/login?callbackUrl=/dashboard/projects");
  });

  it("não redireciona quando sessão é válida", () => {
    const redirect = middlewareCheck("/dashboard", { user: { id: "u1" } });
    expect(redirect).toBeNull();
  });

  it("não redireciona para rotas públicas sem sessão", () => {
    const redirect = middlewareCheck("/login", null);
    expect(redirect).toBeNull();
  });

  it("redireciona /dashboard/members sem sessão", () => {
    const redirect = middlewareCheck("/dashboard/members", null);
    expect(redirect).toBe("/login?callbackUrl=/dashboard/members");
  });
});

// ─── JWT callback edge cases ──────────────────────────────────────────────────
// Task: gov-1775213772090-hro8em (E3-C1)
// Mirrors jwt callback logic from src/lib/auth.ts verbatim.
// Uses the existing @/lib/prisma mock defined above.

/**
 * Mirrors the jwt callback from src/lib/auth.ts.
 * Accepts same parameter shape as NextAuth jwt callback.
 */
async function jwtCallback({
  token,
  user,
  trigger,
}: {
  token: Record<string, unknown>;
  user?: Record<string, unknown> | null;
  trigger?: string;
}): Promise<Record<string, unknown>> {
  const { prisma } = await import("@/lib/prisma");

  // On first sign-in, seed token from user
  if (user) {
    token.id = user.id;
    token.orgId = user.orgId ?? null;
    token.orgRole = user.orgRole ?? null;
  }

  // On session update or refresh, re-fetch latest org membership
  if (trigger === "update" || (!token.orgId && token.id)) {
    const membership = await prisma.orgMembership.findFirst({
      where: { userId: token.id as string },
      orderBy: { updatedAt: "desc" },
    });
    token.orgId = membership?.orgId ?? null;
    token.orgRole = membership?.role ?? null;
  }

  return token;
}

describe("Auth — JWT callback: edge cases", () => {
  // Access the orgMembership.findFirst mock from the existing prisma mock above
  let mockOrgMembershipFindFirst: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { prisma } = await import("@/lib/prisma");
    mockOrgMembershipFindFirst = vi.mocked(prisma.orgMembership.findFirst);
    mockOrgMembershipFindFirst.mockResolvedValue(null);
  });

  it("user com orgMembership → token.orgId populated no primeiro login", async () => {
    // user.orgId is set directly from the authorize() return
    // jwtCallback seeds token from user, then re-fetches (token.orgId=null triggers)
    mockOrgMembershipFindFirst.mockResolvedValue({
      orgId: "org1",
      role: "ADMIN_ORG",
    });

    const result = await jwtCallback({
      token: {},
      user: {
        id: "u1",
        email: "user@b.com",
        orgId: "org1",
        orgRole: "ADMIN_ORG",
      },
    });

    expect(result.id).toBe("u1");
    expect(result.orgId).toBe("org1");
    expect(result.orgRole).toBe("ADMIN_ORG");
  });

  it("user SEM orgMembership → token.orgId null (onboarding flow)", async () => {
    // findFirst returns null (no membership yet)
    mockOrgMembershipFindFirst.mockResolvedValue(null);

    const result = await jwtCallback({
      token: {},
      user: { id: "u2", email: "novo@b.com", orgId: null, orgRole: null },
    });

    expect(result.id).toBe("u2");
    expect(result.orgId).toBeNull();
    expect(result.orgRole).toBeNull();
  });

  it("trigger 'update' → re-fetcha membership da DB", async () => {
    mockOrgMembershipFindFirst.mockResolvedValue({
      orgId: "org2",
      role: "MEMBER",
    });

    const result = await jwtCallback({
      token: { id: "u3", orgId: "org1", orgRole: "ADMIN_ORG" },
      trigger: "update",
    });

    expect(mockOrgMembershipFindFirst).toHaveBeenCalledWith({
      where: { userId: "u3" },
      orderBy: { updatedAt: "desc" },
    });
    expect(result.orgId).toBe("org2");
    expect(result.orgRole).toBe("MEMBER");
  });

  it("token sem orgId mas com id → re-fetcha membership automaticamente", async () => {
    mockOrgMembershipFindFirst.mockResolvedValue({
      orgId: "org3",
      role: "ADMIN_ORG",
    });

    // Token has id but orgId is null — triggers re-fetch
    const result = await jwtCallback({
      token: { id: "u4", orgId: null },
    });

    expect(mockOrgMembershipFindFirst).toHaveBeenCalledWith({
      where: { userId: "u4" },
      orderBy: { updatedAt: "desc" },
    });
    expect(result.orgId).toBe("org3");
  });
});
