/**
 * Meetings module tests — Sprint D3, Task D3-T01 (gov-1775077577131-qpmoks)
 *
 * Testes (red phase TDD — E3):
 *  - Grupo 1: Meeting CRUD (createMeeting, listMeetings, updateMeeting, cancelMeeting)
 *  - Grupo 2: Participantes (addParticipant, markAttendance, removeParticipant, listParticipants)
 *  - Grupo 3: Atas / MeetingMinutes (createMinutes, updateMinutes, publishMinutes, getMinutes)
 *  - Grupo 4: Action Items (createActionItem, assignActionItem, completeActionItem, listActionItems)
 *  - Grupo 5: Transições de estado Meeting (AGENDADA→EM_CURSO, EM_CURSO→CONCLUIDA, etc.)
 *
 * NOTA: Todos os testes devem FALHAR (RED) até D3-T02/T03 implementarem as server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockMeetingCreate = vi.hoisted(() => vi.fn());
const mockMeetingFindMany = vi.hoisted(() => vi.fn());
const mockMeetingFindUnique = vi.hoisted(() => vi.fn());
const mockMeetingUpdate = vi.hoisted(() => vi.fn());

const mockMeetingParticipantCreate = vi.hoisted(() => vi.fn());
const mockMeetingParticipantFindMany = vi.hoisted(() => vi.fn());
const mockMeetingParticipantFindUnique = vi.hoisted(() => vi.fn());
const mockMeetingParticipantUpdate = vi.hoisted(() => vi.fn());
const mockMeetingParticipantDelete = vi.hoisted(() => vi.fn());

const mockMeetingMinutesCreate = vi.hoisted(() => vi.fn());
const mockMeetingMinutesUpdate = vi.hoisted(() => vi.fn());
const mockMeetingMinutesFindUnique = vi.hoisted(() => vi.fn());

const mockActionItemCreate = vi.hoisted(() => vi.fn());
const mockActionItemFindMany = vi.hoisted(() => vi.fn());
const mockActionItemFindUnique = vi.hoisted(() => vi.fn());
const mockActionItemUpdate = vi.hoisted(() => vi.fn());

const mockAuditLogFindFirst = vi.hoisted(() => vi.fn());
const mockAuditLogCreate = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

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
      findMany: mockMeetingParticipantFindMany,
      findUnique: mockMeetingParticipantFindUnique,
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
      findFirst: mockAuditLogFindFirst.mockResolvedValue(null),
      create: mockAuditLogCreate.mockResolvedValue({ id: "audit-stub" }),
    },
    $transaction: mockTransaction,
  },
}));

// Importar funções (não existem ainda — red phase)
import {
  createMeeting,
  listMeetings,
  updateMeeting,
  cancelMeeting,
  addParticipant,
  markAttendance,
  removeParticipant,
  listParticipants,
  createMinutes,
  updateMinutes,
  publishMinutes,
  getMinutes,
  createActionItem,
  assignActionItem,
  completeActionItem,
  listActionItems,
  startMeeting,
  endMeeting,
} from "@/lib/actions/meeting-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseMeetingInput = {
  orgId: "org1",
  projectId: "proj1",
  title: "Reunião de Coordenação",
  scheduledAt: new Date("2026-05-01T10:00:00Z"),
  location: "Sala A",
};

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 1: Meeting CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe("Meetings CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createMeeting com GESTOR_PROJETO → cria meeting com status AGENDADA", async () => {
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

    expect(result.status).toBe("AGENDADA");
    expect(mockMeetingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "AGENDADA",
          orgId: "org1",
          projectId: "proj1",
        }),
      }),
    );
  });

  it("createMeeting com OBSERVADOR → rejeita 403 (sem permissão)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2" } });
    mockOrgMembershipFindUnique.mockResolvedValue({
      id: "mem2",
      role: "OBSERVADOR",
    });

    await expect(createMeeting(baseMeetingInput)).rejects.toThrow(
      /403|proibido|sem permissão|Forbidden/i,
    );
  });

  it("listMeetings → filtra por orgId + projectId (RLS)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
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

  it("listMeetings de outra org → retorna [] (RLS isolation)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    // User pertence à org1 mas pede org2 — RLS deve retornar []
    mockOrgMembershipFindUnique.mockResolvedValue(null); // sem membership na org2
    mockMeetingFindMany.mockResolvedValue([]);

    const result = await listMeetings({ orgId: "org2", projectId: "proj-x" });

    expect(result).toHaveLength(0);
  });

  it("updateMeeting → altera título, data, local", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
    });
    mockMeetingUpdate.mockResolvedValue({
      id: "meet1",
      title: "Novo Título",
      scheduledAt: new Date("2026-05-10T14:00:00Z"),
      location: "Sala B",
      status: "AGENDADA",
    });

    const result = await updateMeeting({
      meetingId: "meet1",
      title: "Novo Título",
      scheduledAt: new Date("2026-05-10T14:00:00Z"),
      location: "Sala B",
    });

    expect(result.title).toBe("Novo Título");
    expect(result.location).toBe("Sala B");
    expect(mockMeetingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "meet1" },
      }),
    );
  });

  it("cancelMeeting → transição AGENDADA → CANCELADA", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
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
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 2: Participantes
// ─────────────────────────────────────────────────────────────────────────────

describe("Meeting Participants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
    });
  });

  it("addParticipant com userId interno → associa User", async () => {
    mockMeetingParticipantCreate.mockResolvedValue({
      id: "part1",
      meetingId: "meet1",
      userId: "u2",
      name: "João Silva",
      email: "joao@example.com",
      attended: false,
    });

    const result = await addParticipant({
      meetingId: "meet1",
      orgId: "org1",
      userId: "u2",
      name: "João Silva",
      email: "joao@example.com",
    });

    expect(result.userId).toBe("u2");
    expect(result.attended).toBe(false);
    expect(mockMeetingParticipantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meetingId: "meet1",
          userId: "u2",
        }),
      }),
    );
  });

  it("addParticipant externo (sem userId) → apenas nome + email", async () => {
    mockMeetingParticipantCreate.mockResolvedValue({
      id: "part2",
      meetingId: "meet1",
      userId: null,
      name: "Empreiteiro Externo",
      email: "empreiteiro@construcao.pt",
      attended: false,
    });

    const result = await addParticipant({
      meetingId: "meet1",
      orgId: "org1",
      name: "Empreiteiro Externo",
      email: "empreiteiro@construcao.pt",
    });

    expect(result.userId).toBeNull();
    expect(result.name).toBe("Empreiteiro Externo");
    expect(mockMeetingParticipantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          name: "Empreiteiro Externo",
        }),
      }),
    );
  });

  it("markAttendance → attended = true", async () => {
    mockMeetingParticipantFindUnique.mockResolvedValue({
      id: "part1",
      meetingId: "meet1",
      attended: false,
    });
    mockMeetingParticipantUpdate.mockResolvedValue({
      id: "part1",
      attended: true,
    });

    const result = await markAttendance({
      participantId: "part1",
      attended: true,
    });

    expect(result.attended).toBe(true);
    expect(mockMeetingParticipantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attended: true }),
      }),
    );
  });

  it("removeParticipant → soft delete ou hard delete", async () => {
    mockMeetingParticipantFindUnique.mockResolvedValue({
      id: "part1",
      meetingId: "meet1",
    });
    mockMeetingParticipantDelete.mockResolvedValue({ id: "part1" });

    await removeParticipant({ participantId: "part1" });

    // Aceita hard delete (delete) ou soft delete (update com deletedAt)
    const wasDeleted = mockMeetingParticipantDelete.mock.calls.length > 0;
    const wasSoftDeleted = mockMeetingParticipantUpdate.mock.calls.some(
      (call: [{ data: { deletedAt?: unknown } }]) => call[0]?.data?.deletedAt,
    );
    expect(wasDeleted || wasSoftDeleted).toBe(true);
  });

  it("listParticipants → inclui internos e externos", async () => {
    mockMeetingParticipantFindMany.mockResolvedValue([
      { id: "part1", userId: "u2", name: "Interno", meetingId: "meet1" },
      {
        id: "part2",
        userId: null,
        name: "Externo",
        email: "ext@ext.pt",
        meetingId: "meet1",
      },
    ]);

    const result = await listParticipants({ meetingId: "meet1" });

    expect(result).toHaveLength(2);
    expect(
      result.some((p: { userId: string | null }) => p.userId !== null),
    ).toBe(true);
    expect(
      result.some((p: { userId: string | null }) => p.userId === null),
    ).toBe(true);
    expect(mockMeetingParticipantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ meetingId: "meet1" }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 3: Atas (MeetingMinutes)
// ─────────────────────────────────────────────────────────────────────────────

describe("Meeting Minutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("createMinutes → meeting deve estar CONCLUIDA ou EM_CURSO", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "CONCLUIDA",
    });
    mockMeetingMinutesCreate.mockResolvedValue({
      id: "min1",
      meetingId: "meet1",
      content: "<p>Acta da reunião</p>",
      publishedAt: null,
    });

    const result = await createMinutes({
      meetingId: "meet1",
      content: "<p>Acta da reunião</p>",
    });

    expect(result.meetingId).toBe("meet1");
    expect(result.content).toBe("<p>Acta da reunião</p>");
  });

  it("createMinutes com meeting AGENDADA → rejeita (meeting não iniciada)", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
    });

    await expect(
      createMinutes({
        meetingId: "meet1",
        content: "<p>Ata prematura</p>",
      }),
    ).rejects.toThrow(/estado|AGENDADA|não pode|inválido/i);
  });

  it("updateMinutes → altera content (rich text)", async () => {
    mockMeetingMinutesFindUnique.mockResolvedValue({
      id: "min1",
      meetingId: "meet1",
      content: "<p>Conteúdo original</p>",
      publishedAt: null,
    });
    mockMeetingMinutesUpdate.mockResolvedValue({
      id: "min1",
      content: "<p>Conteúdo actualizado</p>",
    });

    const result = await updateMinutes({
      minutesId: "min1",
      content: "<p>Conteúdo actualizado</p>",
    });

    expect(result.content).toBe("<p>Conteúdo actualizado</p>");
    expect(mockMeetingMinutesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "<p>Conteúdo actualizado</p>",
        }),
      }),
    );
  });

  it("publishMinutes → define publishedAt + publishedById", async () => {
    mockMeetingMinutesFindUnique.mockResolvedValue({
      id: "min1",
      meetingId: "meet1",
      content: "<p>Ata completa</p>",
      publishedAt: null,
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
        data: expect.objectContaining({
          publishedById: "u1",
        }),
      }),
    );
  });

  it("publishMinutes de meeting CANCELADA → rejeita", async () => {
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
  });

  it("getMinutes → inclui content completo", async () => {
    const fullContent =
      "<p>Ata completa com muito conteúdo</p><ul><li>Ponto 1</li></ul>";
    mockMeetingMinutesFindUnique.mockResolvedValue({
      id: "min1",
      meetingId: "meet1",
      content: fullContent,
      publishedAt: null,
      publishedById: null,
    });

    const result = await getMinutes({ meetingId: "meet1" });

    expect(result.content).toBe(fullContent);
    expect(mockMeetingMinutesFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ meetingId: "meet1" }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 4: Action Items
// ─────────────────────────────────────────────────────────────────────────────

describe("Action Items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("createActionItem → status PENDENTE, associado a meeting", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "EM_CURSO",
    });
    mockActionItemCreate.mockResolvedValue({
      id: "ai1",
      meetingId: "meet1",
      orgId: "org1",
      description: "Enviar planta actualizada",
      status: "PENDENTE",
      assigneeId: null,
      dueDate: null,
    });

    const result = await createActionItem({
      meetingId: "meet1",
      orgId: "org1",
      description: "Enviar planta actualizada",
    });

    expect(result.status).toBe("PENDENTE");
    expect(result.meetingId).toBe("meet1");
    expect(mockActionItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDENTE",
          meetingId: "meet1",
        }),
      }),
    );
  });

  it("assignActionItem → define assigneeId", async () => {
    mockActionItemFindUnique.mockResolvedValue({
      id: "ai1",
      orgId: "org1",
      status: "PENDENTE",
      assigneeId: null,
    });
    mockActionItemUpdate.mockResolvedValue({
      id: "ai1",
      assigneeId: "u3",
      status: "PENDENTE",
    });

    const result = await assignActionItem({
      actionItemId: "ai1",
      assigneeId: "u3",
    });

    expect(result.assigneeId).toBe("u3");
    expect(mockActionItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assigneeId: "u3" }),
      }),
    );
  });

  it("completeActionItem → PENDENTE → CONCLUIDO", async () => {
    mockActionItemFindUnique.mockResolvedValue({
      id: "ai1",
      orgId: "org1",
      status: "PENDENTE",
    });
    mockActionItemUpdate.mockResolvedValue({
      id: "ai1",
      status: "CONCLUIDO",
    });

    const result = await completeActionItem({ actionItemId: "ai1" });

    expect(result.status).toBe("CONCLUIDO");
    expect(mockActionItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONCLUIDO" }),
      }),
    );
  });

  it("listActionItems por meeting → ordenados por dueDate", async () => {
    mockActionItemFindMany.mockResolvedValue([
      {
        id: "ai1",
        meetingId: "meet1",
        status: "PENDENTE",
        dueDate: new Date("2026-05-01"),
      },
      {
        id: "ai2",
        meetingId: "meet1",
        status: "PENDENTE",
        dueDate: new Date("2026-05-15"),
      },
    ]);

    const result = await listActionItems({ meetingId: "meet1" });

    expect(result).toHaveLength(2);
    expect(mockActionItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ meetingId: "meet1" }),
        orderBy: expect.objectContaining({ dueDate: expect.any(String) }),
      }),
    );
  });

  it("actionItem de outra org → não visível (RLS)", async () => {
    // User da org1 não deve ver action items da org2
    mockActionItemFindMany.mockResolvedValue([]);

    const result = await listActionItems({
      meetingId: "meet-org2",
      orgId: "org2",
    });

    // Com RLS activo, retorna []
    expect(result).toHaveLength(0);
    // Verifica que a query inclui orgId para RLS
    expect(mockActionItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: "org2" }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 5: Transições de estado Meeting
// ─────────────────────────────────────────────────────────────────────────────

describe("Meeting Status Transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
  });

  it("AGENDADA → EM_CURSO (startMeeting)", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
    });
    mockMeetingUpdate.mockResolvedValue({
      id: "meet1",
      status: "EM_CURSO",
    });

    const result = await startMeeting({ meetingId: "meet1" });

    expect(result.status).toBe("EM_CURSO");
    expect(mockMeetingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "EM_CURSO" }),
      }),
    );
  });

  it("EM_CURSO → CONCLUIDA (endMeeting)", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "EM_CURSO",
    });
    mockMeetingUpdate.mockResolvedValue({
      id: "meet1",
      status: "CONCLUIDA",
      endedAt: new Date(),
    });

    const result = await endMeeting({ meetingId: "meet1" });

    expect(result.status).toBe("CONCLUIDA");
    expect(mockMeetingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONCLUIDA" }),
      }),
    );
  });

  it("AGENDADA → CANCELADA (cancelMeeting)", async () => {
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
  });

  it("CONCLUIDA → AGENDADA → rejeita (irreversível)", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "CONCLUIDA",
    });

    await expect(
      updateMeeting({ meetingId: "meet1", status: "AGENDADA" }),
    ).rejects.toThrow(/transição|inválida|CONCLUIDA|irreversível/i);
  });

  it("Stamp criado para cada transição (audit trail)", async () => {
    mockMeetingFindUnique.mockResolvedValue({
      id: "meet1",
      orgId: "org1",
      status: "AGENDADA",
    });
    mockMeetingUpdate.mockResolvedValue({
      id: "meet1",
      status: "EM_CURSO",
    });

    await startMeeting({ meetingId: "meet1" });

    // Deve criar um registo de audit log para a transição
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: expect.stringMatching(/MEETING|START|EM_CURSO/i),
        }),
      }),
    );
  });
});
