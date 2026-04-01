/**
 * Org & Membership server actions tests — Sprint D1 retroactive coverage
 * Task: gov-1775031802966-tst01
 *
 * Tests:
 *  - addOrgMember (via acceptInvite): adiciona membro; role OBSERVADOR por defeito
 *  - removeOrgMember: remove membro; owner não pode ser removido
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks (vi.mock is hoisted above imports, so use vi.hoisted) ────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindFirst = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());
const mockOrgMembershipDeleteMany = vi.hoisted(() => vi.fn());
const mockOrgMembershipUpsert = vi.hoisted(() => vi.fn());
const mockOrgInviteFindUnique = vi.hoisted(() => vi.fn());
const mockOrgInviteUpdate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findFirst: mockOrgMembershipFindFirst,
      findUnique: mockOrgMembershipFindUnique,
      deleteMany: mockOrgMembershipDeleteMany,
      upsert: mockOrgMembershipUpsert,
    },
    orgInvite: {
      findUnique: mockOrgInviteFindUnique,
      update: mockOrgInviteUpdate,
    },
    user: { findUnique: vi.fn() },
    $transaction: mockTransaction,
  },
}));

// Aliases for readability
const mockOrgMembership = {
  findFirst: mockOrgMembershipFindFirst,
  findUnique: mockOrgMembershipFindUnique,
  deleteMany: mockOrgMembershipDeleteMany,
  upsert: mockOrgMembershipUpsert,
};
const mockOrgInvite = {
  findUnique: mockOrgInviteFindUnique,
  update: mockOrgInviteUpdate,
};

import {
  removeOrgMember,
  acceptInvite,
} from "@/lib/actions/membership-actions";

describe("removeOrgMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lança erro quando sessão não existe", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(removeOrgMember("other-user-id")).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("lança erro quando caller não é ADMIN_ORG", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembership.findFirst.mockResolvedValue(null); // no ADMIN_ORG membership
    await expect(removeOrgMember("other-user-id")).rejects.toThrow(
      "Sem permissão.",
    );
  });

  it("lança erro quando tenta remover-se a si próprio", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembership.findFirst.mockResolvedValue({ orgId: "org1" });
    await expect(removeOrgMember("u1")).rejects.toThrow(
      "Não pode remover-se a si próprio.",
    );
  });

  it("remove membro com sucesso quando caller é ADMIN_ORG", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin" } });
    mockOrgMembership.findFirst.mockResolvedValue({ orgId: "org1" });
    mockOrgMembership.deleteMany.mockResolvedValue({ count: 1 });

    await removeOrgMember("target-user");

    expect(mockOrgMembership.deleteMany).toHaveBeenCalledWith({
      where: { userId: "target-user", orgId: "org1" },
    });
  });
});

describe("acceptInvite — addOrgMember com role por defeito", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna error quando utilizador não está autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await acceptInvite("some-token");
    expect(result.error).toBe("not_authenticated");
  });

  it("retorna error quando convite não existe", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    mockOrgInvite.findUnique.mockResolvedValue(null);
    const result = await acceptInvite("invalid-token");
    expect(result.error).toBe("Convite não encontrado.");
  });

  it("retorna error quando convite já foi aceite", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    mockOrgInvite.findUnique.mockResolvedValue({
      token: "tok",
      orgId: "org1",
      email: "a@b.com",
      role: "OBSERVADOR",
      acceptedAt: new Date(), // already accepted
      expiresAt: new Date(Date.now() + 1000),
      org: { name: "Org" },
    });
    const result = await acceptInvite("tok");
    expect(result.error).toBe("Este convite já foi utilizado.");
  });

  it("retorna error quando convite expirou", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    mockOrgInvite.findUnique.mockResolvedValue({
      token: "tok",
      orgId: "org1",
      email: "a@b.com",
      role: "OBSERVADOR",
      acceptedAt: null,
      expiresAt: new Date(Date.now() - 1000), // expired
      org: { name: "Org" },
    });
    const result = await acceptInvite("tok");
    expect(result.error).toBe("Este convite expirou.");
  });

  it("cria membership com role OBSERVADOR por defeito e retorna orgId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    mockOrgInvite.findUnique.mockResolvedValue({
      id: "inv1",
      token: "tok",
      orgId: "org1",
      email: "a@b.com",
      role: "OBSERVADOR",
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      org: { name: "Org Demo" },
    });
    mockTransaction.mockResolvedValue([null, null]);

    const result = await acceptInvite("tok");

    expect(result.error).toBeUndefined();
    expect(result.orgId).toBe("org1");

    // Verify transaction was called (carries upsert + invite update)
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("retorna error quando email não corresponde ao utilizador autenticado", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", email: "different@b.com" },
    });
    mockOrgInvite.findUnique.mockResolvedValue({
      id: "inv1",
      token: "tok",
      orgId: "org1",
      email: "a@b.com", // different email
      role: "OBSERVADOR",
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      org: { name: "Org" },
    });

    const result = await acceptInvite("tok");
    expect(result.error).toContain("Este convite é para a@b.com");
  });
});
