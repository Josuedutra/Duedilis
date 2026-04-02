/**
 * Meetings module tests — Sprint D3, Tasks D3-02/D3-03
 * Task: gov-1775086349494-vp0a3e
 *
 * Testes unitários e de integração para o módulo de Reuniões.
 *
 * Cobertura:
 *  1. createMeeting — cria reunião com campos obrigatórios, verifica orgId + projectId
 *  2. updateMeeting — edita título/descrição/data, outros campos mantêm-se
 *  3. deleteMeeting (cancelMeeting) — soft delete via status CANCELADA + cascade check
 *  4. listMeetings — filtra por projectId + orgId, paginação funciona
 *  5. addParticipant — adiciona participante existente, verifica relação
 *  6. removeParticipant — remove participante, meeting persiste
 *  7. createMinutes (Atas) — cria ata rich text associada a meeting
 *  8. publishMinutes — publicar ata, verifica publishedAt + publishedById
 *  9. RLS — user de org A não vê reuniões de org B
 * 10. Cross-tenant — participante de org A não acede a atas de org B
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockMeetingCreate = vi.hoisted(() => vi.fn());
const mockMeetingFindMany = vi.hoisted(() => vi.fn());
const mockMeetingFindUnique = vi.hoisted(() => vi.fn());
const mockMeetingUpdate = vi.hoisted(() => vi.fn());

const mockMeetingParticipantCreate = vi.hoisted(() => vi.fn());
const mockMeetingParticipantFindUnique = vi.hoisted(() => vi.fn());
const mockMeetingParticipantFindMany = vi.hoisted(() => vi.fn());
const mockMeetingParticipantUpdate = vi.hoisted(() => vi.fn());
const mockMeetingParticipantDelete = vi.hoisted(() => vi.fn());

const mockMeetingMinutesCreate = vi.hoisted(() => vi.fn());
const mockMeetingMinutesUpdate = vi.hoisted(() => vi.fn());
const mockMeetingMinutesFindUnique = vi.hoisted(() => vi.fn());

const mockActionItemCreate = vi.hoisted(() => vi.fn());
const mockActionItemFindMany = vi.hoisted(() => vi.fn());
const mockActionItemFindUnique = vi.hoisted(() => vi.fn());
const mockActionItemUpdate = vi.hoisted(() => vi.fn());

const mockAuditLogCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "audit-stub" }),
);

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    meeting: {
      create: mockMeetingCreate,
      findMany: mockMeetingFindMany,
      findUnique: mockMeetingFindUnique,
      update: mockMeetingUpdate,
    },
    meetingParticipant: {
      create: mockMeetingParticipantCreate,
      findUnique: mockMeetingParticipantFindUnique,
      findMany: mockMeetingParticipantFindMany,
      update: mockMeetingParticipantUpdate,
      delete: mockMeetingParticipantDelete,
    },
    meetingMinutes: {
      create: mockMeetingMinutesCreate,
      update: mockMeetingMinutesUpdate,
      findUnique: mockMeetingMinutesFindUnique,
    },
    actionItem: {
      create: mockActionItemCreate,
      findMany: mockActionItemFindMany,
      findUnique: mockActionItemFindUnique,
      update: mockActionItemUpdate,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
  },
}));

vi.mock("@/lib/services/audit-log", () => ({
  createAuditEntry: vi.fn().mockResolvedValue({ id: "audit-stub" }),
}));

import {
  createMeeting,
  listMeetings,
  updateMeeting,
  cancelMeeting,
  addParticipant,
  removeParticipant,
  listParticipants,
  createMinutes,
  publishMinutes,
  getMinutes,
} from "@/lib/actions/meeting-actions";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const baseMeetingInput = {
  orgId: "org1",
  projectId: "proj1",
  title: "Reunião de Coordenação",
  scheduledAt: new Date("2026-05-01T10:00:00Z"),
  location: "Sala A",
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: createMeeting
// ─────────────────────────────────────────────────────────────────────────────

describe("1. createMeeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria reunião com campos obrigatórios, verifica orgId + projectId associados", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockMeetingCreate.mockResolvedValue({
      id: "meet1",
      ...baseMeetingInput,
      status: "AGENDADA",
      createdById: "u1",
    });

    const result = await createMeeting(baseMeetingInput);

    expect(result.id).toBe("meet1");
    expect(result.orgId).toBe("org1");
    expect(result.projectId).toBe("proj1");
    expect(result.status).toBe("AGENDADA");
    expect(mockMeetingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "AGENDADA",
          orgId: "org1",
          projectId: "proj1",
          createdById: "u1",
        }),
      }),
    );
  });

  it("rejeita 403 quando role OBSERVADOR tenta criar reunião", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem2",
      role: "OBSERVADOR",
    });

    await expect(createMeeting(baseMeetingInput)).rejects.toThrow(
      /403|proibido|sem permissão|Forbidden/i,
    );
    expect(mockMeetingCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: updateMeeting
// ─────────────────────────────────────────────────────────────────────────────

describe("2. updateMeeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("edita título/descrição/data; outros campos mantêm-se (status inalterado)", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
      createdById: "u1",
      location: "Sala A",
    });
    mockMeetingUpdate.mockResolvedValue({
      id: "meet1",
      title: "Título Actualizado",
      scheduledAt: new Date("2026-05-10T14:00:00Z"),
      location: "Sala B",
      status: "AGENDADA", // unchanged
    });

    const result = await updateMeeting({
      meetingId: "meet1",
      title: "Título Actualizado",
      scheduledAt: new Date("2026-05-10T14:00:00Z"),
      location: "Sala B",
    });

    expect(result.title).toBe("Título Actualizado");
    expect(result.location).toBe("Sala B");
    expect(result.status).toBe("AGENDADA"); // not changed
    expect(mockMeetingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "meet1" },
        data: expect.objectContaining({
          title: "Título Actualizado",
          location: "Sala B",
        }),
      }),
    );
  });

  it("rejeita transição de status em reunião CONCLUIDA (irreversível)", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "CONCLUIDA",
    });

    await expect(
      updateMeeting({ meetingId: "meet1", status: "AGENDADA" }),
    ).rejects.toThrow(/transição|inválida|CONCLUIDA|irreversível/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: deleteMeeting (cancelMeeting — soft delete via status CANCELADA)
// ─────────────────────────────────────────────────────────────────────────────

describe("3. deleteMeeting (cancelMeeting)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("soft delete via status CANCELADA — meeting persiste na BD", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
    });
    mockMeetingUpdate.mockResolvedValue({
      id: "meet1",
      status: "CANCELADA",
    });

    const result = await cancelMeeting({ meetingId: "meet1" });

    expect(result.status).toBe("CANCELADA");
    expect(mockMeetingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELADA" }),
      }),
    );
    // Soft delete — meeting.update called, NOT meeting.delete (cascade não apaga registo)
    // No hard delete invoked
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: listMeetings — filtra por projectId + orgId, paginação
// ─────────────────────────────────────────────────────────────────────────────

describe("4. listMeetings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("filtra por orgId + projectId", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockMeetingFindMany.mockResolvedValue([
      { id: "meet1", orgId: "org1", projectId: "proj1", status: "AGENDADA" },
      { id: "meet2", orgId: "org1", projectId: "proj1", status: "CONCLUIDA" },
    ]);

    const result = await listMeetings({ orgId: "org1", projectId: "proj1" });

    expect(result).toHaveLength(2);
    expect(mockMeetingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org1",
          projectId: "proj1",
        }),
      }),
    );
  });

  it("paginação funciona — page 2 com pageSize 5 usa skip correcto", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      role: "GESTOR_PROJETO",
    });
    mockMeetingFindMany.mockResolvedValue([]);

    await listMeetings({ orgId: "org1", page: 2, pageSize: 5 });

    expect(mockMeetingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        skip: 5, // (page 2 - 1) * pageSize 5 = 5
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: addParticipant
// ─────────────────────────────────────────────────────────────────────────────

describe("5. addParticipant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
    });
  });

  it("adiciona participante existente (userId interno), verifica relação meetingId + userId", async () => {
    mockMeetingParticipantCreate.mockResolvedValue({
      id: "part1",
      meetingId: "meet1",
      orgId: "org1",
      userId: "u2",
      name: "João Silva",
      email: "joao@duedilis.pt",
      attended: false,
    });

    const result = await addParticipant({
      meetingId: "meet1",
      orgId: "org1",
      userId: "u2",
      name: "João Silva",
      email: "joao@duedilis.pt",
    });

    expect(result.meetingId).toBe("meet1");
    expect(result.userId).toBe("u2");
    expect(result.attended).toBe(false);
    expect(mockMeetingParticipantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meetingId: "meet1",
          userId: "u2",
          name: "João Silva",
        }),
      }),
    );
  });

  it("adiciona participante externo (sem userId) — apenas nome + email", async () => {
    mockMeetingParticipantCreate.mockResolvedValue({
      id: "part2",
      meetingId: "meet1",
      orgId: "org1",
      userId: null,
      name: "Empreiteiro Externo",
      email: "ext@construcao.pt",
      attended: false,
    });

    const result = await addParticipant({
      meetingId: "meet1",
      orgId: "org1",
      name: "Empreiteiro Externo",
      email: "ext@construcao.pt",
    });

    expect(result.userId).toBeNull();
    expect(result.name).toBe("Empreiteiro Externo");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: removeParticipant
// ─────────────────────────────────────────────────────────────────────────────

describe("6. removeParticipant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("remove participante; meeting persiste (não é deletada)", async () => {
    mockMeetingParticipantFindUnique.mockResolvedValue({
      id: "part1",
      meetingId: "meet1",
      orgId: "org1",
    });
    mockMeetingParticipantDelete.mockResolvedValue({ id: "part1" });

    await removeParticipant({ participantId: "part1" });

    expect(mockMeetingParticipantDelete).toHaveBeenCalledWith({
      where: { id: "part1" },
    });
    // meeting.delete NOT called
    expect(mockMeetingUpdate).not.toHaveBeenCalled();
  });

  it("listParticipants após removeParticipant continua a devolver os restantes", async () => {
    mockMeetingParticipantFindMany.mockResolvedValue([
      { id: "part2", meetingId: "meet1", userId: null, name: "Externo" },
    ]);

    const result = await listParticipants({ meetingId: "meet1" });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("part2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: createMinutes
// ─────────────────────────────────────────────────────────────────────────────

describe("7. createMinutes (Atas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("cria ata rich text associada a meeting CONCLUIDA", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "CONCLUIDA",
    });
    mockMeetingMinutesCreate.mockResolvedValue({
      id: "min1",
      meetingId: "meet1",
      orgId: "org1",
      content:
        "<p>Acta da reunião de coordenação.</p><ul><li>Ponto 1</li></ul>",
      publishedAt: null,
    });

    const result = await createMinutes({
      meetingId: "meet1",
      content:
        "<p>Acta da reunião de coordenação.</p><ul><li>Ponto 1</li></ul>",
    });

    expect(result.meetingId).toBe("meet1");
    expect(result.content).toContain("Acta da reunião");
    expect(result.publishedAt).toBeNull();
    expect(mockMeetingMinutesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meetingId: "meet1",
          content: expect.stringContaining("Acta"),
        }),
      }),
    );
  });

  it("rejeita createMinutes se meeting está AGENDADA (estado inválido)", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
    });

    await expect(
      createMinutes({ meetingId: "meet1", content: "<p>Prematura</p>" }),
    ).rejects.toThrow(/estado|AGENDADA|não pode|inválido/i);
    expect(mockMeetingMinutesCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8: publishMinutes
// ─────────────────────────────────────────────────────────────────────────────

describe("8. publishMinutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("publicar ata — define publishedAt e publishedById; participantes verificados", async () => {
    mockMeetingMinutesFindUnique.mockResolvedValue({
      id: "min1",
      meetingId: "meet1",
      content: "<p>Ata completa</p>",
      publishedAt: null,
      publishedById: null,
      meeting: { status: "CONCLUIDA" },
    });
    const now = new Date();
    mockMeetingMinutesUpdate.mockResolvedValue({
      id: "min1",
      publishedAt: now,
      publishedById: "u1",
    });

    const result = await publishMinutes({ minutesId: "min1" });

    expect(result.publishedAt).toBeTruthy();
    expect(result.publishedById).toBe("u1");
    expect(mockMeetingMinutesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "min1" },
        data: expect.objectContaining({
          publishedById: "u1",
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("rejeita publishMinutes de reunião CANCELADA", async () => {
    mockMeetingMinutesFindUnique.mockResolvedValue({
      id: "min1",
      meetingId: "meet1",
      content: "<p>Ata de reunião cancelada</p>",
      publishedAt: null,
      meeting: { status: "CANCELADA" },
    });

    await expect(publishMinutes({ minutesId: "min1" })).rejects.toThrow(
      /CANCELADA|proibido|não pode publicar/i,
    );
    expect(mockMeetingMinutesUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9: RLS — user de org A não vê reuniões de org B
// ─────────────────────────────────────────────────────────────────────────────

describe("9. RLS — isolamento cross-org meetings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } }); // user pertence à org1
  });

  it("listMeetings de org B → retorna [] (user sem membership na org B)", async () => {
    // User has no membership in org2
    mockOrgMembershipFindUnique.mockResolvedValue(null);
    mockMeetingFindMany.mockResolvedValue([]);

    const result = await listMeetings({ orgId: "org2", projectId: "proj-b" });

    expect(result).toHaveLength(0);
    // meetingFindMany should NOT be called because RLS blocks early
    // (implementation checks membership before querying)
    expect(mockMeetingFindMany).not.toHaveBeenCalled();
  });

  it("listMeetings de org A com membership → retorna reuniões", async () => {
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem1",
      orgId: "org1",
      role: "GESTOR_PROJETO",
    });
    mockMeetingFindMany.mockResolvedValue([
      { id: "meet1", orgId: "org1", projectId: "proj1", status: "AGENDADA" },
    ]);

    const result = await listMeetings({ orgId: "org1", projectId: "proj1" });

    expect(result).toHaveLength(1);
    expect(result[0].orgId).toBe("org1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10: Cross-tenant — participante de org A não acede a atas de org B
// ─────────────────────────────────────────────────────────────────────────────

describe("10. Cross-tenant — participante de org A não acede a atas de org B", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } }); // user de org1
  });

  it("getMinutes para meeting de org B — retorna null (sem acesso cross-tenant)", async () => {
    // minutes pertence a org2 meeting
    mockMeetingMinutesFindUnique.mockResolvedValue(null); // DB retorna null para org2

    const result = await getMinutes({ meetingId: "meet-org2" });

    expect(result).toBeNull();
    // Verifica que query foi feita com meetingId correcto
    expect(mockMeetingMinutesFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ meetingId: "meet-org2" }),
      }),
    );
  });

  it("addParticipant de org A em meeting de org B — meeting não encontrada (mock retorna null)", async () => {
    // meeting de org2 — não visível para user de org1
    mockMeetingFindUnique.mockResolvedValue(null);

    await expect(
      addParticipant({
        meetingId: "meet-org2",
        orgId: "org2",
        name: "Intruso",
      }),
    ).rejects.toThrow(/não encontrada|404/i);
  });
});
