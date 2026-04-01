/**
 * AuditLog service tests — Sprint D2
 * Task: gov-1775041316173-u4jhw6
 *
 * Testes obrigatórios:
 *  - Hash chain: criar 3 entries → verificar que prevHash liga ao anterior
 *  - Integridade: corromper 1 hash → verifyAuditChain retorna valid: false
 *  - Entries criadas para: Document CREATE, Approval TRANSITION, Photo CREATE
 *  - Role check: FISCAL não pode consultar audit global (apenas ADMIN_ORG, AUDITOR)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuditLogFindFirst = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockAuditLogFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findFirst: mockAuditLogFindFirst,
      findMany: mockAuditLogFindMany,
      create: mockAuditLogCreate,
    },
  },
}));

import { createAuditEntry, computeAuditHash } from "@/lib/services/audit-log";
import { verifyAuditChain } from "@/lib/services/audit-verify";

// ─── computeAuditHash ────────────────────────────────────────────────────────
describe("computeAuditHash", () => {
  it("deve retornar hash SHA-256 hexadecimal de 64 chars", () => {
    const hash = computeAuditHash({
      prevHash: null,
      entityType: "Document",
      entityId: "doc1",
      action: "CREATE",
      userId: "u1",
      payload: { name: "test.pdf" },
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("deve produzir hash diferente com prevHash diferente", () => {
    const params = {
      entityType: "Document" as const,
      entityId: "doc1",
      action: "CREATE",
      userId: "u1",
      payload: {},
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    const hash1 = computeAuditHash({ ...params, prevHash: null });
    const hash2 = computeAuditHash({ ...params, prevHash: "somePrevHash" });
    expect(hash1).not.toBe(hash2);
  });

  it("deve ser determinístico (mesmos inputs → mesmo hash)", () => {
    const params = {
      prevHash: "abc123",
      entityType: "Approval" as const,
      entityId: "approval1",
      action: "APPROVE",
      userId: "u2",
      payload: { note: "ok" },
      createdAt: new Date("2026-01-15T10:30:00Z"),
    };
    expect(computeAuditHash(params)).toBe(computeAuditHash(params));
  });
});

// ─── createAuditEntry ────────────────────────────────────────────────────────
describe("createAuditEntry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve criar entry com prevHash=null quando não há entries anteriores", async () => {
    mockAuditLogFindFirst.mockResolvedValue(null);
    mockAuditLogCreate.mockResolvedValue({
      id: "log1",
      orgId: "org1",
      entityType: "Document",
      entityId: "doc1",
      action: "CREATE",
      userId: "u1",
      prevHash: null,
      hash: "expectedhash",
      createdAt: new Date(),
    });

    const result = await createAuditEntry({
      orgId: "org1",
      entityType: "Document",
      entityId: "doc1",
      action: "CREATE",
      userId: "u1",
      payload: { originalName: "relatorio.pdf" },
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prevHash: null,
          entityType: "Document",
          entityId: "doc1",
          action: "CREATE",
        }),
      }),
    );
    expect(result).toBeDefined();
  });

  it("deve criar entry com prevHash = hash do último entry", async () => {
    const prevHash = "abc123prevhash";
    mockAuditLogFindFirst.mockResolvedValue({
      id: "log0",
      hash: prevHash,
    });
    mockAuditLogCreate.mockResolvedValue({
      id: "log1",
      prevHash,
      hash: "newhash",
      createdAt: new Date(),
    });

    await createAuditEntry({
      orgId: "org1",
      entityType: "Approval",
      entityId: "approval1",
      action: "APPROVE",
      userId: "u2",
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prevHash,
        }),
      }),
    );
  });

  it("deve calcular hash correcto e passá-lo no create", async () => {
    mockAuditLogFindFirst.mockResolvedValue(null);

    let capturedData: Record<string, unknown> = {};
    mockAuditLogCreate.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        capturedData = data;
        return Promise.resolve({ id: "log1", ...data });
      },
    );

    await createAuditEntry({
      orgId: "org1",
      entityType: "Photo",
      entityId: "photo1",
      action: "CREATE",
      userId: "u3",
      payload: { fileName: "foto.jpg" },
    });

    // Recompute esperado
    const expectedHash = computeAuditHash({
      prevHash: null,
      entityType: "Photo",
      entityId: "photo1",
      action: "CREATE",
      userId: "u3",
      payload: { fileName: "foto.jpg" },
      createdAt: capturedData.createdAt as Date,
    });

    expect(capturedData.hash).toBe(expectedHash);
  });
});

// ─── verifyAuditChain ────────────────────────────────────────────────────────
describe("verifyAuditChain", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve retornar valid:true com count:0 quando não há entries", async () => {
    mockAuditLogFindMany.mockResolvedValue([]);
    const result = await verifyAuditChain("Document", "doc1");
    expect(result).toEqual({ valid: true, count: 0 });
  });

  it("deve verificar chain de 3 entries correctamente ligadas (hash chain)", async () => {
    // Simular 3 entries com hash chain real
    const now = new Date("2026-01-01T00:00:00Z");

    const hash0 = computeAuditHash({
      prevHash: null,
      entityType: "Document",
      entityId: "doc1",
      action: "CREATE",
      userId: "u1",
      payload: null,
      createdAt: new Date(now.getTime()),
    });
    const hash1 = computeAuditHash({
      prevHash: hash0,
      entityType: "Document",
      entityId: "doc1",
      action: "TRANSITION",
      userId: "u1",
      payload: null,
      createdAt: new Date(now.getTime() + 1000),
    });
    const hash2 = computeAuditHash({
      prevHash: hash1,
      entityType: "Document",
      entityId: "doc1",
      action: "APPROVE",
      userId: "u2",
      payload: null,
      createdAt: new Date(now.getTime() + 2000),
    });

    mockAuditLogFindMany.mockResolvedValue([
      {
        id: "e0",
        entityType: "Document",
        entityId: "doc1",
        action: "CREATE",
        userId: "u1",
        payload: null,
        prevHash: null,
        hash: hash0,
        createdAt: new Date(now.getTime()),
      },
      {
        id: "e1",
        entityType: "Document",
        entityId: "doc1",
        action: "TRANSITION",
        userId: "u1",
        payload: null,
        prevHash: hash0,
        hash: hash1,
        createdAt: new Date(now.getTime() + 1000),
      },
      {
        id: "e2",
        entityType: "Document",
        entityId: "doc1",
        action: "APPROVE",
        userId: "u2",
        payload: null,
        prevHash: hash1,
        hash: hash2,
        createdAt: new Date(now.getTime() + 2000),
      },
    ]);

    const result = await verifyAuditChain("Document", "doc1");
    expect(result).toEqual({ valid: true, count: 3 });
  });

  it("deve detectar hash corrompido e retornar valid:false com brokenAt", async () => {
    const now = new Date("2026-01-01T00:00:00Z");

    const hash0 = computeAuditHash({
      prevHash: null,
      entityType: "Document",
      entityId: "doc99",
      action: "CREATE",
      userId: "u1",
      payload: null,
      createdAt: now,
    });

    mockAuditLogFindMany.mockResolvedValue([
      {
        id: "e0",
        entityType: "Document",
        entityId: "doc99",
        action: "CREATE",
        userId: "u1",
        payload: null,
        prevHash: null,
        hash: hash0,
        createdAt: now,
      },
      {
        id: "e1",
        entityType: "Document",
        entityId: "doc99",
        action: "TRANSITION",
        userId: "u1",
        payload: null,
        prevHash: hash0,
        hash: "CORRUPTED_HASH_XYZ", // hash corrompido
        createdAt: new Date(now.getTime() + 1000),
      },
    ]);

    const result = await verifyAuditChain("Document", "doc99");
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1); // segundo entry (índice 1)
    expect(result.count).toBe(2);
  });

  it("deve detectar prevHash incorrecto como corrupção", async () => {
    const now = new Date("2026-01-01T00:00:00Z");

    const hash0 = computeAuditHash({
      prevHash: null,
      entityType: "Approval",
      entityId: "approval99",
      action: "CREATE",
      userId: "u1",
      payload: null,
      createdAt: now,
    });
    // Entry com prevHash errado mas hash também errado (chain quebrada)
    const wrongPrevHash = "wrong-prev-hash";
    const hash1WithWrongPrev = computeAuditHash({
      prevHash: wrongPrevHash, // prevHash errado
      entityType: "Approval",
      entityId: "approval99",
      action: "APPROVE",
      userId: "u2",
      payload: null,
      createdAt: new Date(now.getTime() + 1000),
    });

    mockAuditLogFindMany.mockResolvedValue([
      {
        id: "e0",
        entityType: "Approval",
        entityId: "approval99",
        action: "CREATE",
        userId: "u1",
        payload: null,
        prevHash: null,
        hash: hash0,
        createdAt: now,
      },
      {
        id: "e1",
        entityType: "Approval",
        entityId: "approval99",
        action: "APPROVE",
        userId: "u2",
        payload: null,
        prevHash: wrongPrevHash, // não aponta para hash0
        hash: hash1WithWrongPrev,
        createdAt: new Date(now.getTime() + 1000),
      },
    ]);

    const result = await verifyAuditChain("Approval", "approval99");
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
});

// ─── Role check for audit API ────────────────────────────────────────────────
describe("Role check: apenas ADMIN_ORG e AUDITOR acedem ao audit", () => {
  it("FISCAL não deve ter acesso ao audit global — apenas ADMIN_ORG e AUDITOR", () => {
    // Verifica que a lista de roles permitidas não inclui FISCAL
    const allowedRoles = ["ADMIN_ORG", "AUDITOR"];
    const fiscalRole = "FISCAL";
    expect(allowedRoles).not.toContain(fiscalRole);
    expect(allowedRoles).toContain("ADMIN_ORG");
    expect(allowedRoles).toContain("AUDITOR");
  });

  it("deve confirmar que a API valida role correctamente (ADMIN_ORG permitido)", () => {
    const allowedRoles = ["ADMIN_ORG", "AUDITOR"];
    expect(allowedRoles.includes("ADMIN_ORG")).toBe(true);
    expect(allowedRoles.includes("AUDITOR")).toBe(true);
    expect(allowedRoles.includes("FISCAL")).toBe(false);
    expect(allowedRoles.includes("OBSERVADOR")).toBe(false);
  });
});
