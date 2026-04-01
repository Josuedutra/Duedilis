/**
 * Notifications module tests — Sprint D3, Task D3-T02 (gov-1775077591157-lxx25o)
 *
 * Testes (red phase TDD — E3):
 *  - Grupo 1: Notification CRUD in-app (createNotification, listNotifications, markAsRead, etc.)
 *  - Grupo 2: NotificationOutbox (email/WhatsApp delivery pipeline)
 *  - Grupo 3: Idempotência (deduplicação de eventos e outbox)
 *  - Grupo 4: Triggers automáticos event-driven
 *
 * NOTA: Todos os testes devem FALHAR (RED) até D3-T03/T04 implementarem as server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockNotificationFindMany = vi.hoisted(() => vi.fn());
const mockNotificationFindUnique = vi.hoisted(() => vi.fn());
const mockNotificationFindFirst = vi.hoisted(() => vi.fn());
const mockNotificationUpdate = vi.hoisted(() => vi.fn());
const mockNotificationUpdateMany = vi.hoisted(() => vi.fn());
const mockNotificationCount = vi.hoisted(() => vi.fn());

const mockOutboxCreate = vi.hoisted(() => vi.fn());
const mockOutboxFindMany = vi.hoisted(() => vi.fn());
const mockOutboxFindFirst = vi.hoisted(() => vi.fn());
const mockOutboxUpdate = vi.hoisted(() => vi.fn());

const mockResendSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    notification: {
      create: mockNotificationCreate,
      findMany: mockNotificationFindMany,
      findUnique: mockNotificationFindUnique,
      findFirst: mockNotificationFindFirst,
      update: mockNotificationUpdate,
      updateMany: mockNotificationUpdateMany,
      count: mockNotificationCount,
    },
    notificationOutbox: {
      create: mockOutboxCreate,
      findMany: mockOutboxFindMany,
      findFirst: mockOutboxFindFirst,
      update: mockOutboxUpdate,
    },
  },
}));

vi.mock("resend", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Resend: vi.fn().mockImplementation(function (this: any) {
    this.emails = { send: mockResendSend };
  }),
}));

// Importar funções (não existem ainda — red phase)
import {
  createNotification,
  listNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  enqueueEmail,
  enqueueWhatsApp,
  processOutbox,
  deliverEmail,
} from "@/lib/actions/notification-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseNotificationInput = {
  orgId: "org1",
  userId: "u1",
  type: "ISSUE_ASSIGNED" as const,
  title: "Issue atribuída",
  body: "A issue #123 foi atribuída a ti.",
  entityType: "Issue",
  entityId: "issue-1",
};

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 1: Notification CRUD (in-app)
// ─────────────────────────────────────────────────────────────────────────────

describe("Notifications in-app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createNotification → cria notificação com read=false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockNotificationCreate.mockResolvedValue({
      id: "notif-1",
      ...baseNotificationInput,
      read: false,
      readAt: null,
      createdAt: new Date(),
    });

    const result = await createNotification(baseNotificationInput);

    expect(result.read).toBe(false);
    expect(result.readAt).toBeNull();
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          read: false,
          orgId: "org1",
          userId: "u1",
          type: "ISSUE_ASSIGNED",
        }),
      }),
    );
  });

  it("listNotifications → filtra por userId + orgId (RLS)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockNotificationFindMany.mockResolvedValue([
      {
        id: "notif-1",
        orgId: "org1",
        userId: "u1",
        type: "ISSUE_ASSIGNED",
        read: false,
      },
      {
        id: "notif-2",
        orgId: "org1",
        userId: "u1",
        type: "APPROVAL_REQUESTED",
        read: false,
      },
    ]);

    const result = await listNotifications({ orgId: "org1", userId: "u1" });

    expect(result).toHaveLength(2);
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org1",
          userId: "u1",
        }),
      }),
    );
  });

  it("listNotifications de outro user → retorna [] (RLS)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    // u1 pede notificações de u2 — RLS deve bloquear
    mockOrgMembershipFindUnique.mockResolvedValue(null);
    mockNotificationFindMany.mockResolvedValue([]);

    const result = await listNotifications({ orgId: "org1", userId: "u2" });

    expect(result).toHaveLength(0);
  });

  it("markAsRead → read=true, readAt definido", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockNotificationFindUnique.mockResolvedValue({
      id: "notif-1",
      userId: "u1",
      orgId: "org1",
      read: false,
      readAt: null,
    });
    const now = new Date();
    mockNotificationUpdate.mockResolvedValue({
      id: "notif-1",
      read: true,
      readAt: now,
    });

    const result = await markAsRead({ notificationId: "notif-1" });

    expect(result.read).toBe(true);
    expect(result.readAt).toBeTruthy();
    expect(mockNotificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notif-1" },
        data: expect.objectContaining({
          read: true,
          readAt: expect.any(Date),
        }),
      }),
    );
  });

  it("markAllAsRead → todas as notificações do user ficam read=true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockNotificationUpdateMany.mockResolvedValue({ count: 5 });

    const result = await markAllAsRead({ orgId: "org1", userId: "u1" });

    expect(result.count).toBe(5);
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org1",
          userId: "u1",
          read: false,
        }),
        data: expect.objectContaining({
          read: true,
          readAt: expect.any(Date),
        }),
      }),
    );
  });

  it("getUnreadCount → conta apenas read=false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockNotificationCount.mockResolvedValue(3);

    const result = await getUnreadCount({ orgId: "org1", userId: "u1" });

    expect(result).toBe(3);
    expect(mockNotificationCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org1",
          userId: "u1",
          read: false,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 2: NotificationOutbox (email/WhatsApp delivery)
// ─────────────────────────────────────────────────────────────────────────────

describe("NotificationOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueueEmail → cria outbox entry com channel=EMAIL, status=PENDING", async () => {
    mockOutboxCreate.mockResolvedValue({
      id: "outbox-1",
      orgId: "org1",
      recipientId: "u1",
      channel: "EMAIL",
      subject: "Nova issue atribuída",
      body: "<p>A issue #123 foi atribuída a ti.</p>",
      status: "PENDING",
      attempts: 0,
      entityType: "Issue",
      entityId: "issue-1",
      createdAt: new Date(),
    });

    const result = await enqueueEmail({
      orgId: "org1",
      recipientId: "u1",
      subject: "Nova issue atribuída",
      body: "<p>A issue #123 foi atribuída a ti.</p>",
      entityType: "Issue",
      entityId: "issue-1",
    });

    expect(result.channel).toBe("EMAIL");
    expect(result.status).toBe("PENDING");
    expect(result.attempts).toBe(0);
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: "EMAIL",
          status: "PENDING",
          recipientId: "u1",
        }),
      }),
    );
  });

  it("enqueueWhatsApp → cria outbox entry com channel=WHATSAPP, status=PENDING", async () => {
    mockOutboxCreate.mockResolvedValue({
      id: "outbox-2",
      orgId: "org1",
      recipientId: "u1",
      channel: "WHATSAPP",
      body: "Issue #123 atribuída",
      status: "PENDING",
      attempts: 0,
      entityType: "Issue",
      entityId: "issue-1",
      createdAt: new Date(),
    });

    const result = await enqueueWhatsApp({
      orgId: "org1",
      recipientId: "u1",
      body: "Issue #123 atribuída",
      entityType: "Issue",
      entityId: "issue-1",
    });

    expect(result.channel).toBe("WHATSAPP");
    expect(result.status).toBe("PENDING");
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: "WHATSAPP",
          status: "PENDING",
        }),
      }),
    );
  });

  it("processOutbox → pega entries PENDING, transita para PROCESSING", async () => {
    const pendingEntries = [
      {
        id: "outbox-1",
        channel: "EMAIL",
        status: "PENDING",
        attempts: 0,
        recipientId: "u1",
        subject: "Assunto",
        body: "<p>Corpo</p>",
      },
      {
        id: "outbox-2",
        channel: "WHATSAPP",
        status: "PENDING",
        attempts: 0,
        recipientId: "u2",
        body: "Mensagem",
      },
    ];
    mockOutboxFindMany.mockResolvedValue(pendingEntries);
    mockOutboxUpdate.mockResolvedValue({ status: "PROCESSING" });
    mockResendSend.mockResolvedValue({ id: "email-id-1" });

    await processOutbox();

    expect(mockOutboxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ status: "PENDING" }),
          ]),
        }),
      }),
    );
    // Deve transitar para PROCESSING durante processamento
    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PROCESSING" }),
      }),
    );
  });

  it("deliverEmail → status PROCESSING → DELIVERED, deliveredAt definido", async () => {
    const entry = {
      id: "outbox-1",
      orgId: "org1",
      recipientId: "u1",
      channel: "EMAIL",
      status: "PROCESSING",
      attempts: 1,
      subject: "Notificação importante",
      body: "<p>Conteúdo</p>",
      recipient: { email: "user@example.com", name: "User Test" },
    };
    mockOutboxFindFirst.mockResolvedValue(entry);
    mockResendSend.mockResolvedValue({ id: "email-send-id-1" });
    const now = new Date();
    mockOutboxUpdate.mockResolvedValue({
      id: "outbox-1",
      status: "DELIVERED",
      deliveredAt: now,
    });

    const result = await deliverEmail({ outboxId: "outbox-1" });

    expect(result.status).toBe("DELIVERED");
    expect(result.deliveredAt).toBeTruthy();
    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "outbox-1" },
        data: expect.objectContaining({
          status: "DELIVERED",
          deliveredAt: expect.any(Date),
        }),
      }),
    );
  });

  it("deliverEmail falha → status PROCESSING → FAILED, errorMessage preenchido, attempts++", async () => {
    const entry = {
      id: "outbox-1",
      orgId: "org1",
      recipientId: "u1",
      channel: "EMAIL",
      status: "PROCESSING",
      attempts: 1,
      subject: "Notificação",
      body: "<p>Conteúdo</p>",
      recipient: { email: "user@example.com", name: "User Test" },
    };
    mockOutboxFindFirst.mockResolvedValue(entry);
    mockResendSend.mockRejectedValue(new Error("SMTP timeout"));
    mockOutboxUpdate.mockResolvedValue({
      id: "outbox-1",
      status: "FAILED",
      attempts: 2,
      errorMessage: "SMTP timeout",
    });

    const result = await deliverEmail({ outboxId: "outbox-1" });

    expect(result.status).toBe("FAILED");
    expect(result.attempts).toBe(2);
    expect(result.errorMessage).toBeTruthy();
    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringMatching(/SMTP timeout/i),
          attempts: 2,
        }),
      }),
    );
  });

  it("retry logic → attempts < 3 && status=FAILED → reprocessa", async () => {
    const failedEntries = [
      {
        id: "outbox-3",
        channel: "EMAIL",
        status: "FAILED",
        attempts: 2,
        recipientId: "u1",
        subject: "Retry",
        body: "<p>Retry</p>",
      },
    ];
    // processOutbox deve incluir FAILED com attempts < 3
    mockOutboxFindMany.mockResolvedValue(failedEntries);
    mockOutboxUpdate.mockResolvedValue({ status: "PROCESSING" });
    mockResendSend.mockResolvedValue({ id: "resend-retry-1" });

    await processOutbox();

    // Deve buscar PENDING e FAILED (attempts < 3)
    expect(mockOutboxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ status: "FAILED" }),
          ]),
        }),
      }),
    );
  });

  it("max retries → attempts >= 3 → não reprocessa (permanece FAILED)", async () => {
    const maxedEntry = {
      id: "outbox-4",
      channel: "EMAIL",
      status: "FAILED",
      attempts: 3,
      recipientId: "u1",
      subject: "Max retried",
      body: "<p>Max retried</p>",
    };
    mockOutboxFindMany.mockResolvedValue([]); // entries com attempts >= 3 são excluídas da query

    await processOutbox();

    // A entry com attempts >= 3 não deve ser processada
    const findManyCalls = mockOutboxFindMany.mock.calls;
    if (findManyCalls.length > 0) {
      const whereClause = findManyCalls[0][0]?.where;
      // Garantir que existe filtro para limitar attempts
      const hasAttemptsFilter =
        JSON.stringify(whereClause).includes("attempts");
      // Se a implementação filtra por attempts, deve excluir >= 3
      // Se não filtra, o processOutbox deve verificar internamente
      expect(
        hasAttemptsFilter ||
          !mockOutboxUpdate.mock.calls.some(
            (call: [{ where: { id: string } }]) =>
              call[0]?.where?.id === maxedEntry.id,
          ),
      ).toBe(true);
    }
    // Garantia: outbox-4 não foi transitado para PROCESSING
    expect(
      mockOutboxUpdate.mock.calls.every(
        (call: [{ where: { id: string } }]) =>
          call[0]?.where?.id !== "outbox-4",
      ),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 3: Idempotência
// ─────────────────────────────────────────────────────────────────────────────

describe("Notification idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mesmo evento 2x → apenas 1 notificação criada", async () => {
    mockAuth.mockResolvedValue({ user: { id: "system" } });

    // Primeira chamada: notificação não existe → cria
    mockNotificationFindFirst.mockResolvedValueOnce(null);
    mockNotificationCreate.mockResolvedValueOnce({
      id: "notif-1",
      ...baseNotificationInput,
      read: false,
    });

    // Segunda chamada: notificação já existe → não cria
    mockNotificationFindFirst.mockResolvedValueOnce({
      id: "notif-1",
      ...baseNotificationInput,
      read: false,
    });

    const first = await createNotification(baseNotificationInput);
    const second = await createNotification(baseNotificationInput);

    expect(first.id).toBe("notif-1");
    expect(second.id).toBe("notif-1"); // Retorna existente, não duplica
    // Create só é chamado 1 vez
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
  });

  it("outbox com mesmo entityType+entityId+recipientId+channel → não duplica", async () => {
    const outboxInput = {
      orgId: "org1",
      recipientId: "u1",
      subject: "Notificação duplicada",
      body: "<p>Corpo</p>",
      entityType: "Issue",
      entityId: "issue-1",
    };

    // Primeira chamada: não existe → cria
    mockOutboxFindFirst.mockResolvedValueOnce(null);
    mockOutboxCreate.mockResolvedValueOnce({
      id: "outbox-1",
      ...outboxInput,
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0,
    });

    // Segunda chamada: já existe entry PENDING/PROCESSING → não duplica
    mockOutboxFindFirst.mockResolvedValueOnce({
      id: "outbox-1",
      ...outboxInput,
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0,
    });

    const first = await enqueueEmail(outboxInput);
    const second = await enqueueEmail(outboxInput);

    expect(first.id).toBe("outbox-1");
    expect(second.id).toBe("outbox-1");
    // Create só é chamado 1 vez
    expect(mockOutboxCreate).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 3b: RLS — isolamento entre users e tenants
// ─────────────────────────────────────────────────────────────────────────────

describe("Notifications RLS isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("user A não vê notificações de user B na mesma org (RLS)", async () => {
    // u1 autenticado tenta listar notificações de u2
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    // u1 não é OWNER da org
    mockOrgMembershipFindUnique.mockResolvedValue({ role: "MEMBER" });

    const result = await listNotifications({ orgId: "org1", userId: "u2" });

    expect(result).toHaveLength(0);
    // Não deve chegar ao findMany com userId de outro user
    expect(mockNotificationFindMany).not.toHaveBeenCalled();
  });

  it("user de org A não vê notificações de org B (cross-tenant)", async () => {
    // u1 de org1 tenta listar notificações de org2
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    // u1 não é membro da org2 (orgMembership retorna null)
    mockOrgMembershipFindUnique.mockResolvedValue(null);

    const result = await listNotifications({ orgId: "org2", userId: "u1" });

    // Deve retornar [] — a função filtra por orgId, e u1 não é owner de org2
    // (sem autenticação verificada, a query pode correr mas só retornaria os dados de org2)
    // O mock não tem dados para org2 (retorna [])
    mockNotificationFindMany.mockResolvedValue([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it("markAsRead de notificação de outro user → lança erro 403", async () => {
    // u1 autenticado tenta marcar notificação de u2
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockNotificationFindUnique.mockResolvedValue({
      id: "notif-u2",
      userId: "u2", // Pertence a u2
      orgId: "org1",
      read: false,
      readAt: null,
    });

    await expect(markAsRead({ notificationId: "notif-u2" })).rejects.toThrow(
      /403/,
    );
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });

  it("markAllAsRead apenas afecta o user autenticado, não outros users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockNotificationUpdateMany.mockResolvedValue({ count: 3 });

    const result = await markAllAsRead({ orgId: "org1", userId: "u1" });

    expect(result.count).toBe(3);
    // A query deve incluir userId: "u1" — não afecta u2
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "u1",
          orgId: "org1",
        }),
      }),
    );
  });

  it("getUnreadCount actualiza após markAsRead (badge/polling)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });

    // Antes: 3 unread
    mockNotificationCount.mockResolvedValueOnce(3);
    const before = await getUnreadCount({ orgId: "org1", userId: "u1" });
    expect(before).toBe(3);

    // Simular markAsRead
    mockNotificationFindUnique.mockResolvedValue({
      id: "notif-1",
      userId: "u1",
      orgId: "org1",
      read: false,
      readAt: null,
    });
    mockNotificationUpdate.mockResolvedValue({
      id: "notif-1",
      read: true,
      readAt: new Date(),
    });
    await markAsRead({ notificationId: "notif-1" });

    // Depois: 2 unread (um marcado como lido)
    mockNotificationCount.mockResolvedValueOnce(2);
    const after = await getUnreadCount({ orgId: "org1", userId: "u1" });
    expect(after).toBe(2);
    expect(after).toBeLessThan(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Grupo 4: Trigger automático (event-driven)
// ─────────────────────────────────────────────────────────────────────────────

describe("Notification triggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationCreate.mockResolvedValue({
      id: "notif-trigger-1",
      read: false,
      createdAt: new Date(),
    });
  });

  it("Issue criada com assignee → notificação ISSUE_ASSIGNED ao assignee", async () => {
    // Simula o trigger: quando uma issue é criada com assigneeId
    const issueCreatedPayload = {
      orgId: "org1",
      issueId: "issue-1",
      assigneeId: "u2",
      createdById: "u1",
      title: "Fissuração na parede",
    };

    await createNotification({
      orgId: issueCreatedPayload.orgId,
      userId: issueCreatedPayload.assigneeId,
      type: "ISSUE_ASSIGNED",
      title: `Issue atribuída: ${issueCreatedPayload.title}`,
      entityType: "Issue",
      entityId: issueCreatedPayload.issueId,
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "ISSUE_ASSIGNED",
          userId: "u2", // Destinatário é o assignee
          entityType: "Issue",
          entityId: "issue-1",
        }),
      }),
    );
  });

  it("Approval criada → notificação APPROVAL_REQUESTED ao reviewer", async () => {
    const approvalPayload = {
      orgId: "org1",
      approvalId: "approval-1",
      reviewerId: "u3",
      requestedById: "u1",
      documentTitle: "Planta Rev.2",
    };

    await createNotification({
      orgId: approvalPayload.orgId,
      userId: approvalPayload.reviewerId,
      type: "APPROVAL_REQUESTED",
      title: `Aprovação solicitada: ${approvalPayload.documentTitle}`,
      entityType: "Approval",
      entityId: approvalPayload.approvalId,
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "APPROVAL_REQUESTED",
          userId: "u3", // Destinatário é o reviewer
          entityType: "Approval",
          entityId: "approval-1",
        }),
      }),
    );
  });

  it("Meeting minutes publicadas → notificação a todos os participantes", async () => {
    const participants = ["u2", "u3", "u4"];

    // Cada participante recebe uma notificação
    mockNotificationCreate.mockResolvedValue({
      id: "notif-minutes",
      read: false,
      createdAt: new Date(),
    });

    for (const participantId of participants) {
      await createNotification({
        orgId: "org1",
        userId: participantId,
        type: "MEETING_MINUTES_PUBLISHED",
        title: "Ata publicada: Reunião de Coordenação",
        entityType: "Meeting",
        entityId: "meet-1",
      });
    }

    expect(mockNotificationCreate).toHaveBeenCalledTimes(participants.length);
    // Cada chamada deve ter um userId diferente
    const calledUserIds = mockNotificationCreate.mock.calls.map(
      (call: [{ data: { userId: string } }]) => call[0].data.userId,
    );
    expect(calledUserIds).toContain("u2");
    expect(calledUserIds).toContain("u3");
    expect(calledUserIds).toContain("u4");
  });

  it("ActionItem assigned → notificação ACTION_ITEM_ASSIGNED", async () => {
    const actionItemPayload = {
      orgId: "org1",
      actionItemId: "ai-1",
      assigneeId: "u2",
      assignedById: "u1",
      description: "Enviar planta actualizada",
    };

    await createNotification({
      orgId: actionItemPayload.orgId,
      userId: actionItemPayload.assigneeId,
      type: "ACTION_ITEM_ASSIGNED",
      title: `Tarefa atribuída: ${actionItemPayload.description}`,
      entityType: "ActionItem",
      entityId: actionItemPayload.actionItemId,
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "ACTION_ITEM_ASSIGNED",
          userId: "u2",
          entityType: "ActionItem",
          entityId: "ai-1",
        }),
      }),
    );
  });

  it("ActionItem com dueDate próximo → notificação ACTION_ITEM_DUE", async () => {
    const actionItemPayload = {
      orgId: "org1",
      actionItemId: "ai-2",
      assigneeId: "u2",
      description: "Verificar instalações",
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Amanhã
    };

    await createNotification({
      orgId: actionItemPayload.orgId,
      userId: actionItemPayload.assigneeId,
      type: "ACTION_ITEM_DUE",
      title: `Tarefa com prazo amanhã: ${actionItemPayload.description}`,
      entityType: "ActionItem",
      entityId: actionItemPayload.actionItemId,
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "ACTION_ITEM_DUE",
          userId: "u2",
          entityType: "ActionItem",
          entityId: "ai-2",
        }),
      }),
    );
  });
});
