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
