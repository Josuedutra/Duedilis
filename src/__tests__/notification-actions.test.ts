/**
 * Notification Actions tests — Sprint D3, Task D3-06/07
 * (gov-1775091680663-g3ylie)
 *
 * Testes unitários GREEN para notification-actions.ts:
 *  1. listNotifications — filtra por orgId, ordena por createdAt DESC
 *  2. markAsRead — marca notificação individual como lida, retorna registo actualizado
 *  3. markAllAsRead — marca todas as não lidas do user como lidas
 *  4. Outbox: createNotification insere no outbox com status=PENDING (via enqueueEmail)
 *  5. Worker: processOutbox transita PENDING→DELIVERED em sucesso, PENDING→FAILED em erro
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());

const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockNotificationFindMany = vi.hoisted(() => vi.fn());
const mockNotificationFindFirst = vi.hoisted(() => vi.fn());
const mockNotificationFindUnique = vi.hoisted(() => vi.fn());
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
      findFirst: mockNotificationFindFirst,
      findUnique: mockNotificationFindUnique,
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

import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  enqueueEmail,
  processOutbox,
} from "@/lib/actions/notification-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseNotif = {
  id: "notif-1",
  orgId: "org-test",
  userId: "user-1",
  type: "ISSUE_ASSIGNED",
  title: "Issue atribuída",
  read: false,
  readAt: null,
  createdAt: new Date("2026-04-01T10:00:00Z"),
};

const laterNotif = {
  id: "notif-2",
  orgId: "org-test",
  userId: "user-1",
  type: "APPROVAL_REQUESTED",
  title: "Aprovação pedida",
  read: false,
  readAt: null,
  createdAt: new Date("2026-04-01T12:00:00Z"),
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. listNotifications
// ─────────────────────────────────────────────────────────────────────────────

describe("listNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("filtra por orgId e userId", async () => {
    mockNotificationFindMany.mockResolvedValue([baseNotif]);

    const result = await listNotifications({
      orgId: "org-test",
      userId: "user-1",
    });

    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-test",
          userId: "user-1",
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].orgId).toBe("org-test");
  });

  it("ordena por createdAt DESC (mais recente primeiro)", async () => {
    // Retorna já ordenado conforme a query (mock simula o resultado)
    mockNotificationFindMany.mockResolvedValue([laterNotif, baseNotif]);

    const result = await listNotifications({
      orgId: "org-test",
      userId: "user-1",
    });

    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
    // Mais recente é o primeiro
    expect(result[0].id).toBe("notif-2");
    expect(result[1].id).toBe("notif-1");
  });

  it("retorna [] se não há notificações", async () => {
    mockNotificationFindMany.mockResolvedValue([]);

    const result = await listNotifications({
      orgId: "org-test",
      userId: "user-1",
    });

    expect(result).toHaveLength(0);
  });

  it("aplica limit ao número de resultados", async () => {
    mockNotificationFindMany.mockResolvedValue([baseNotif]);

    await listNotifications({ orgId: "org-test", userId: "user-1", limit: 10 });

    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. markAsRead
// ─────────────────────────────────────────────────────────────────────────────

describe("markAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("marca notificação como lida e retorna registo actualizado", async () => {
    mockNotificationFindUnique.mockResolvedValue({
      ...baseNotif,
      userId: "user-1",
    });
    const readAt = new Date();
    mockNotificationUpdate.mockResolvedValue({
      ...baseNotif,
      read: true,
      readAt,
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

  it("retorna o registo actualizado com read=true", async () => {
    mockNotificationFindUnique.mockResolvedValue({
      ...baseNotif,
      userId: "user-1",
    });
    mockNotificationUpdate.mockResolvedValue({
      id: "notif-1",
      read: true,
      readAt: new Date(),
      type: "ISSUE_ASSIGNED",
      title: "Issue atribuída",
    });

    const result = await markAsRead({ notificationId: "notif-1" });

    expect(result).toHaveProperty("read", true);
    expect(result).toHaveProperty("id", "notif-1");
  });

  it("lança 403 se notificação pertence a outro utilizador", async () => {
    mockNotificationFindUnique.mockResolvedValue({
      ...baseNotif,
      userId: "user-2", // Pertence a user-2, não user-1
    });

    await expect(markAsRead({ notificationId: "notif-1" })).rejects.toThrow(
      /403/,
    );
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. markAllAsRead
// ─────────────────────────────────────────────────────────────────────────────

describe("markAllAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("marca todas as notificações não lidas do utilizador como lidas", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 4 });

    const result = await markAllAsRead({ orgId: "org-test", userId: "user-1" });

    expect(result.count).toBe(4);
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-test",
          userId: "user-1",
          read: false,
        }),
        data: expect.objectContaining({
          read: true,
          readAt: expect.any(Date),
        }),
      }),
    );
  });

  it("retorna count=0 se não havia notificações por ler", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 0 });

    const result = await markAllAsRead({ orgId: "org-test", userId: "user-1" });

    expect(result.count).toBe(0);
  });

  it("filtra apenas o userId autenticado — não afecta outros utilizadores", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 2 });

    await markAllAsRead({ orgId: "org-test", userId: "user-1" });

    const callArgs = mockNotificationUpdateMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ userId: "user-1" });
    // Não deve actualizar com userId diferente
    expect(callArgs.where.userId).not.toBe("user-2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Outbox: enqueueEmail insere com status=PENDING
// ─────────────────────────────────────────────────────────────────────────────

describe("Outbox — enqueueEmail insere com status=PENDING", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria entrada no outbox com status=PENDING", async () => {
    mockOutboxFindFirst.mockResolvedValue(null); // Sem duplicado
    mockOutboxCreate.mockResolvedValue({
      id: "outbox-1",
      orgId: "org-test",
      recipientId: "user-1",
      channel: "EMAIL",
      subject: "Notificação de teste",
      body: "<p>Teste</p>",
      status: "PENDING",
      attempts: 0,
      entityType: "Issue",
      entityId: "issue-1",
      createdAt: new Date(),
    });

    const result = await enqueueEmail({
      orgId: "org-test",
      recipientId: "user-1",
      subject: "Notificação de teste",
      body: "<p>Teste</p>",
      entityType: "Issue",
      entityId: "issue-1",
    });

    expect(result.status).toBe("PENDING");
    expect(result.attempts).toBe(0);
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          channel: "EMAIL",
          recipientId: "user-1",
        }),
      }),
    );
  });

  it("nova entrada tem attempts=0", async () => {
    mockOutboxFindFirst.mockResolvedValue(null);
    mockOutboxCreate.mockResolvedValue({
      id: "outbox-2",
      status: "PENDING",
      attempts: 0,
      channel: "EMAIL",
    });

    const result = await enqueueEmail({
      orgId: "org-test",
      recipientId: "user-1",
      subject: "Assunto",
      body: "<p>Corpo</p>",
    });

    expect(result.attempts).toBe(0);
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: 0 }),
      }),
    );
  });

  it("não duplica se já existe entrada PENDING para o mesmo entityId", async () => {
    const existing = {
      id: "outbox-existing",
      status: "PENDING",
      attempts: 0,
      channel: "EMAIL",
    };
    mockOutboxFindFirst.mockResolvedValue(existing);

    const result = await enqueueEmail({
      orgId: "org-test",
      recipientId: "user-1",
      subject: "Assunto",
      body: "<p>Corpo</p>",
      entityType: "Issue",
      entityId: "issue-dup",
    });

    expect(result.id).toBe("outbox-existing");
    expect(mockOutboxCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Worker: processOutbox PENDING→DELIVERED em sucesso, PENDING→FAILED em erro
// ─────────────────────────────────────────────────────────────────────────────

describe("Worker — processOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transita PENDING→DELIVERED quando envio de email tem sucesso", async () => {
    mockOutboxFindMany.mockResolvedValue([
      {
        id: "outbox-ok",
        channel: "EMAIL",
        status: "PENDING",
        attempts: 0,
        recipientId: "user@example.com",
        subject: "Assunto",
        body: "<p>Corpo</p>",
      },
    ]);
    mockOutboxUpdate.mockResolvedValue({ status: "DELIVERED" });
    mockResendSend.mockResolvedValue({ id: "resend-ok-1" });

    await processOutbox();

    // Deve primeiro transitar para PROCESSING
    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "outbox-ok" },
        data: expect.objectContaining({ status: "PROCESSING" }),
      }),
    );

    // Depois de sucesso, deve transitar para DELIVERED
    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "outbox-ok" },
        data: expect.objectContaining({ status: "DELIVERED" }),
      }),
    );
  });

  it("transita PENDING→FAILED quando envio de email falha", async () => {
    mockOutboxFindMany.mockResolvedValue([
      {
        id: "outbox-fail",
        channel: "EMAIL",
        status: "PENDING",
        attempts: 0,
        recipientId: "user@example.com",
        subject: "Assunto",
        body: "<p>Corpo</p>",
      },
    ]);
    mockOutboxUpdate.mockResolvedValue({ status: "FAILED" });
    mockResendSend.mockRejectedValue(new Error("SMTP connection refused"));

    await processOutbox();

    // Após falha, deve gravar status=FAILED com errorMessage
    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "outbox-fail" },
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("SMTP connection refused"),
        }),
      }),
    );
  });

  it("busca entradas PENDING e FAILED (attempts < 3) — OR query", async () => {
    mockOutboxFindMany.mockResolvedValue([]);

    await processOutbox();

    expect(mockOutboxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ status: "PENDING" }),
            expect.objectContaining({
              status: "FAILED",
              attempts: { lt: 3 },
            }),
          ]),
        }),
      }),
    );
  });

  it("não processa entradas FAILED com attempts >= 3 (max retries)", async () => {
    // Entrys com attempts >= 3 não devem ser retornadas pela query (OR filter)
    mockOutboxFindMany.mockResolvedValue([]); // Nada a processar

    await processOutbox();

    // Nenhum update deve ter sido chamado
    expect(mockOutboxUpdate).not.toHaveBeenCalled();
  });

  it("processa múltiplas entradas em sequência", async () => {
    mockOutboxFindMany.mockResolvedValue([
      {
        id: "outbox-a",
        channel: "EMAIL",
        status: "PENDING",
        attempts: 0,
        recipientId: "a@example.com",
        subject: "A",
        body: "<p>A</p>",
      },
      {
        id: "outbox-b",
        channel: "EMAIL",
        status: "PENDING",
        attempts: 0,
        recipientId: "b@example.com",
        subject: "B",
        body: "<p>B</p>",
      },
    ]);
    mockOutboxUpdate.mockResolvedValue({ status: "DELIVERED" });
    mockResendSend.mockResolvedValue({ id: "resend-multi" });

    await processOutbox();

    // Deve ter processado 2 entradas (2x PROCESSING + 2x DELIVERED = 4 updates)
    expect(mockOutboxUpdate).toHaveBeenCalledTimes(4);
  });
});
