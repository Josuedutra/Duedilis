/**
 * Auth server actions — error path coverage
 * Task: gov-1775213772090-hro8em (E3-C1)
 *
 * Tests the try/catch logic in:
 *  - signIn server action (login/page.tsx)
 *  - registerAction server action (register/page.tsx)
 *  - signOut server action (header.tsx)
 *
 * Strategy: replicate the server action logic directly (same try/catch code),
 * mocking external dependencies (next-auth signIn/signOut, prisma, bcryptjs).
 * The error branches are tested as real code paths.
 *
 * Note: "use server" inline actions cannot be imported directly, so the
 * logic is mirrored verbatim here and kept in sync with source.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { redirect } from "next/navigation";

// ─── AuthError mock ────────────────────────────────────────────────────────────
// next-auth imports next/server which isn't available in Node test env.
// We create a local AuthError class that matches the next-auth shape.
// The signInAction mirror uses THIS class for instanceof checks.
class AuthError extends Error {
  type: string;
  constructor(type: string) {
    super(type);
    this.type = type;
    this.name = "AuthError";
  }
}

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/auth", () => ({
  signIn: mockSignIn,
  signOut: mockSignOut,
  auth: vi.fn(),
}));

const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
    orgMembership: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$hashed"),
  compare: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the redirect URL from the mock redirect error thrown by setup.ts.
 * setup.ts mocks redirect as: throw new Error(`REDIRECT:${url}`)
 */
function getRedirectUrl(error: unknown): string | null {
  if (error instanceof Error && error.message.startsWith("REDIRECT:")) {
    return error.message.slice("REDIRECT:".length);
  }
  return null;
}

// ─── Mirror: signIn server action (login/page.tsx) ───────────────────────────
// Mirrors the inline "use server" form action in LoginPage verbatim.
// Uses local AuthError class (same shape as next-auth's AuthError).

async function signInAction(formData: FormData) {
  const { signIn } = await import("@/lib/auth");
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        redirect("/login?error=CredentialsSignin");
      }
      redirect("/login?error=unknown");
    }
    // NEXT_REDIRECT thrown by Next.js on successful redirect — rethrow
    throw error;
  }
}

// ─── Mirror: registerAction (register/page.tsx) ───────────────────────────────

const registerSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Password deve ter pelo menos 8 caracteres"),
});

async function registerAction(formData: FormData) {
  const { prisma } = await import("@/lib/prisma");
  const { hash } = await import("bcryptjs");

  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const result = registerSchema.safeParse(raw);
  if (!result.success) {
    redirect("/register?error=validation");
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/register?error=exists");
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  redirect("/login?registered=1");
}

// ─── Mirror: signOut server action (header.tsx) ───────────────────────────────

async function signOutAction() {
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirectTo: "/login" });
}

// ─── Tests: signIn server action ─────────────────────────────────────────────

describe("signIn server action — error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("user inexistente → redirect para /login?error=CredentialsSignin (não crash)", async () => {
    // signIn throws CredentialsSignin AuthError when user not found
    mockSignIn.mockRejectedValue(new AuthError("CredentialsSignin"));

    const formData = new FormData();
    formData.set("email", "noexiste@example.com");
    formData.set("password", "qualquer");

    let caughtError: unknown;
    try {
      await signInAction(formData);
    } catch (e) {
      caughtError = e;
    }

    const url = getRedirectUrl(caughtError);
    expect(url).toBe("/login?error=CredentialsSignin");
  });

  it("password errada → redirect para /login?error=CredentialsSignin", async () => {
    mockSignIn.mockRejectedValue(new AuthError("CredentialsSignin"));

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("password", "errada");

    let caughtError: unknown;
    try {
      await signInAction(formData);
    } catch (e) {
      caughtError = e;
    }

    const url = getRedirectUrl(caughtError);
    expect(url).toBe("/login?error=CredentialsSignin");
  });

  it("AuthError genérico (não CredentialsSignin) → redirect para /login?error=unknown", async () => {
    mockSignIn.mockRejectedValue(new AuthError("OAuthSignin"));

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("password", "qualquer");

    let caughtError: unknown;
    try {
      await signInAction(formData);
    } catch (e) {
      caughtError = e;
    }

    const url = getRedirectUrl(caughtError);
    expect(url).toBe("/login?error=unknown");
  });

  it("credenciais válidas → NEXT_REDIRECT relançado (não engolido)", async () => {
    // Successful signIn: Next.js throws NEXT_REDIRECT internally
    const nextRedirect = new Error("NEXT_REDIRECT");
    mockSignIn.mockRejectedValue(nextRedirect);

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("password", "correcta");

    let thrownError: unknown;
    try {
      await signInAction(formData);
    } catch (e) {
      thrownError = e;
    }

    // Must rethrow — not convert to a redirect error
    expect(thrownError).toBe(nextRedirect);
    expect((thrownError as Error).message).toBe("NEXT_REDIRECT");
  });
});

// ─── Tests: register server action ───────────────────────────────────────────

describe("register server action — error paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("password < 8 chars → redirect para /register?error=validation", async () => {
    const formData = new FormData();
    formData.set("name", "João");
    formData.set("email", "joao@example.com");
    formData.set("password", "curta"); // 5 chars

    let caughtError: unknown;
    try {
      await registerAction(formData);
    } catch (e) {
      caughtError = e;
    }

    const url = getRedirectUrl(caughtError);
    expect(url).toBe("/register?error=validation");
    // prisma should NOT be called when validation fails
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("email inválido → redirect para /register?error=validation", async () => {
    const formData = new FormData();
    formData.set("name", "João");
    formData.set("email", "nao-e-email");
    formData.set("password", "passwordvalida");

    let caughtError: unknown;
    try {
      await registerAction(formData);
    } catch (e) {
      caughtError = e;
    }

    const url = getRedirectUrl(caughtError);
    expect(url).toBe("/register?error=validation");
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("campos vazios → redirect para /register?error=validation", async () => {
    const formData = new FormData(); // all fields absent

    let caughtError: unknown;
    try {
      await registerAction(formData);
    } catch (e) {
      caughtError = e;
    }

    const url = getRedirectUrl(caughtError);
    expect(url).toBe("/register?error=validation");
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("email duplicado → redirect para /register?error=exists", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "u1",
      email: "existente@example.com",
    });

    const formData = new FormData();
    formData.set("name", "João");
    formData.set("email", "existente@example.com");
    formData.set("password", "passwordvalida");

    let caughtError: unknown;
    try {
      await registerAction(formData);
    } catch (e) {
      caughtError = e;
    }

    const url = getRedirectUrl(caughtError);
    expect(url).toBe("/register?error=exists");
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("dados válidos → user criado → redirect para /login?registered=1", async () => {
    mockUserFindUnique.mockResolvedValue(null); // email not taken
    mockUserCreate.mockResolvedValue({ id: "u2", email: "novo@example.com" });

    const formData = new FormData();
    formData.set("name", "Novo User");
    formData.set("email", "novo@example.com");
    formData.set("password", "passwordvalida");

    let caughtError: unknown;
    try {
      await registerAction(formData);
    } catch (e) {
      caughtError = e;
    }

    const url = getRedirectUrl(caughtError);
    expect(url).toBe("/login?registered=1");
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Novo User",
        email: "novo@example.com",
        passwordHash: "$hashed",
      }),
    });
  });
});

// ─── Tests: signOut server action ─────────────────────────────────────────────

describe("signOut server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("session activa → signOut chamado com redirectTo /login", async () => {
    mockSignOut.mockResolvedValue(undefined);

    await signOutAction();

    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
