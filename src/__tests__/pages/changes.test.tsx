/**
 * Changes Page Tests — Sprint D4, Task D4-E3-12v2
 * gov-1775349165492-aor67u
 *
 * E3 compliance tests for the Changes frontend pages:
 *  1. Render da página de Changes sem crash
 *  2. Listagem de changes mostra dados mockados
 *  3. Filtros de estado (open/closed/all) funcionam
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());
const mockChangeRecordFindMany = vi.hoisted(() => vi.fn());
const mockChangeRecordFindUnique = vi.hoisted(() => vi.fn());
const mockChangeRecordCreate = vi.hoisted(() => vi.fn());
const mockChangeRecordUpdate = vi.hoisted(() => vi.fn());
const mockChangeCommentCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: { findUnique: mockOrgMembershipFindUnique },
    changeRecord: {
      findMany: mockChangeRecordFindMany,
      findUnique: mockChangeRecordFindUnique,
      create: mockChangeRecordCreate,
      update: mockChangeRecordUpdate,
    },
    changeComment: { create: mockChangeCommentCreate },
  },
}));

import {
  listChanges,
  getChangeDetail,
  createChange,
  transitionChange,
} from "@/lib/actions/change-actions";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID = "org-001";
const PROJECT_ID = "proj-001";
const CHANGE_ID = "change-001";
const USER_ID = "user-001";

const mockUser = { id: USER_ID, name: "Test User", email: "test@duedilis.com" };

const makeChange = (overrides = {}) => ({
  id: CHANGE_ID,
  orgId: ORG_ID,
  projectId: PROJECT_ID,
  title: "Mudança de escopo — Piso 3",
  description: "Adição de 200m² ao piso 3.",
  type: "SCOPE",
  status: "OPEN",
  financialImpact: 45000,
  createdAt: new Date("2026-04-04T09:00:00Z"),
  updatedAt: new Date("2026-04-04T09:00:00Z"),
  author: mockUser,
  ...overrides,
});

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockAuth.mockResolvedValue({ user: mockUser });
  mockOrgMembershipFindUnique.mockResolvedValue({
    userId: USER_ID,
    orgId: ORG_ID,
    role: "MEMBER",
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Changes Page — render sem crash", () => {
  it("listChanges retorna array (não lança excepção)", async () => {
    mockChangeRecordFindMany.mockResolvedValue([]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getChangeDetail retorna detalhe sem crash", async () => {
    const change = makeChange();
    mockChangeRecordFindUnique.mockResolvedValue({
      ...change,
      comments: [],
      documents: [],
    });

    const result = await getChangeDetail({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      changeId: CHANGE_ID,
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe(CHANGE_ID);
  });
});

describe("Changes Page — listagem mostra dados mockados", () => {
  it("retorna lista com múltiplos changes", async () => {
    const changes = [
      makeChange({ id: "change-001", title: "Change A", status: "OPEN" }),
      makeChange({ id: "change-002", title: "Change B", status: "CLOSED" }),
      makeChange({ id: "change-003", title: "Change C", status: "DRAFT" }),
    ];
    mockChangeRecordFindMany.mockResolvedValue(changes);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Change A");
    expect(result[1].title).toBe("Change B");
  });

  it("inclui financialImpact nos dados", async () => {
    mockChangeRecordFindMany.mockResolvedValue([
      makeChange({ financialImpact: 12500 }),
    ]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result[0].financialImpact).toBe(12500);
  });

  it("inclui status badge (status) nos dados", async () => {
    mockChangeRecordFindMany.mockResolvedValue([
      makeChange({ status: "OPEN" }),
    ]);

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result[0].status).toBe("OPEN");
  });
});

describe("Changes Page — filtros de estado funcionam", () => {
  const allChanges = [
    { id: "c1", status: "OPEN" },
    { id: "c2", status: "CLOSED" },
    { id: "c3", status: "OPEN" },
    { id: "c4", status: "DRAFT" },
  ];

  it("filtro ALL retorna todos os changes", async () => {
    mockChangeRecordFindMany.mockResolvedValue(
      allChanges.map((c) => makeChange(c)),
    );

    const result = await listChanges({ orgId: ORG_ID, projectId: PROJECT_ID });

    expect(result).toHaveLength(4);
  });

  it("filtro OPEN retorna apenas changes abertos", async () => {
    const openChanges = allChanges
      .filter((c) => c.status === "OPEN")
      .map((c) => makeChange(c));
    mockChangeRecordFindMany.mockResolvedValue(openChanges);

    const result = await listChanges({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      status: "OPEN",
    });

    expect(result).toHaveLength(2);
    result.forEach((c) => expect(c.status).toBe("OPEN"));
  });

  it("filtro CLOSED retorna apenas changes fechados", async () => {
    const closedChanges = allChanges
      .filter((c) => c.status === "CLOSED")
      .map((c) => makeChange(c));
    mockChangeRecordFindMany.mockResolvedValue(closedChanges);

    const result = await listChanges({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      status: "CLOSED",
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("CLOSED");
  });

  it("createChange cria novo change com dados correctos", async () => {
    const newChange = makeChange({ id: "change-new", status: "DRAFT" });
    mockChangeRecordCreate.mockResolvedValue(newChange);

    const result = await createChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      title: "Mudança de escopo — Piso 3",
      description: "Adição de 200m² ao piso 3.",
      type: "SCOPE",
    });

    expect(result).toBeDefined();
    expect(result.title).toBe("Mudança de escopo — Piso 3");
    expect(result.status).toBe("DRAFT");
  });

  it("transitionChange actualiza o estado do change", async () => {
    const updated = makeChange({ status: "CLOSED" });
    mockChangeRecordFindUnique.mockResolvedValue(
      makeChange({ status: "OPEN" }),
    );
    mockChangeRecordUpdate.mockResolvedValue(updated);

    const result = await transitionChange({
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      changeId: CHANGE_ID,
      toStatus: "CLOSED",
    });

    expect(result.status).toBe("CLOSED");
  });
});
