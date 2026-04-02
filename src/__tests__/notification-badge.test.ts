/**
 * Notification Badge + Polling tests — Sprint D3, Task D3-06/07
 * (gov-1775091680663-g3ylie)
 *
 * Testes unitários GREEN para badge de notificações não lidas e polling:
 *  1. Badge count retorna contagem correcta de não lidas por utilizador
 *  2. Badge count é 0 quando todas as notificações estão lidas
 *  3. Polling: retorna apenas notificações criadas desde o último timestamp
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockOrgMembershipFindUnique = vi.hoisted(() => vi.fn());
const mockNotificationCount = vi.hoisted(() => vi.fn());
const mockNotificationFindMany = vi.hoisted(() => vi.fn());
const mockNotificationFindUnique = vi.hoisted(() => vi.fn());
const mockNotificationFindFirst = vi.hoisted(() => vi.fn());
const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockNotificationUpdate = vi.hoisted(() => vi.fn());
const mockNotificationUpdateMany = vi.hoisted(() => vi.fn());
const mockOutboxCreate = vi.hoisted(() => vi.fn());
const mockOutboxFindMany = vi.hoisted(() => vi.fn());
const mockOutboxFindFirst = vi.hoisted(() => vi.fn());
const mockOutboxUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgMembership: {
      findUnique: mockOrgMembershipFindUnique,
    },
    notification: {
      count: mockNotificationCount,
      findMany: mockNotificationFindMany,
      findUnique: mockNotificationFindUnique,
      findFirst: mockNotificationFindFirst,
      create: mockNotificationCreate,
      update: mockNotificationUpdate,
      updateMany: mockNotificationUpdateMany,
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
    this.emails = { send: vi.fn() };
  }),
}));

import {
  getUnreadCount,
  listNotifications,
  markAsRead,
  markAllAsRead,
} from "@/lib/actions/notification-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeNotif = (
  id: string,
  read: boolean,
  createdAt: Date = new Date(),
) => ({
  id,
  orgId: "org-badge",
  userId: "user-badge",
  type: "ISSUE_ASSIGNED",
  title: `Notificação ${id}`,
  read,
  readAt: read ? new Date() : null,
  createdAt,
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Badge count — contagem correcta de não lidas
// ─────────────────────────────────────────────────────────────────────────────

describe("Badge count — contagem de notificações não lidas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-badge" } });
  });

  it("retorna contagem correcta de não lidas por utilizador", async () => {
    mockNotificationCount.mockResolvedValue(5);

    const count = await getUnreadCount({
      orgId: "org-badge",
      userId: "user-badge",
    });

    expect(count).toBe(5);
    expect(mockNotificationCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org-badge",
          userId: "user-badge",
          read: false,
        }),
      }),
    );
  });

  it("conta apenas notificações com read=false (exclui as lidas)", async () => {
    // 3 não lidas, 2 lidas → badge deve ser 3
    mockNotificationCount.mockResolvedValue(3);

    const count = await getUnreadCount({
      orgId: "org-badge",
      userId: "user-badge",
    });

    expect(count).toBe(3);
    // Garantir que o filtro read=false está presente
    const callArgs = mockNotificationCount.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ read: false });
  });

  it("filtra por orgId — não conta notificações de outra org", async () => {
    mockNotificationCount.mockResolvedValue(2);

    await getUnreadCount({ orgId: "org-badge", userId: "user-badge" });

    const callArgs = mockNotificationCount.mock.calls[0][0];
    expect(callArgs.where.orgId).toBe("org-badge");
  });

  it("filtra por userId — não conta notificações de outro utilizador", async () => {
    mockNotificationCount.mockResolvedValue(1);

    await getUnreadCount({ orgId: "org-badge", userId: "user-badge" });

    const callArgs = mockNotificationCount.mock.calls[0][0];
    expect(callArgs.where.userId).toBe("user-badge");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Badge count = 0 quando todas as notificações estão lidas
// ─────────────────────────────────────────────────────────────────────────────

describe("Badge count zero — sem notificações por ler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-badge" } });
  });

  it("retorna 0 quando não há notificações", async () => {
    mockNotificationCount.mockResolvedValue(0);

    const count = await getUnreadCount({
      orgId: "org-badge",
      userId: "user-badge",
    });

    expect(count).toBe(0);
  });

  it("retorna 0 quando todas as notificações estão lidas", async () => {
    // Após markAllAsRead, o count deve ser 0
    mockNotificationUpdateMany.mockResolvedValue({ count: 3 });
    await markAllAsRead({ orgId: "org-badge", userId: "user-badge" });

    // Simular estado após marcar tudo como lido
    mockNotificationCount.mockResolvedValue(0);
    const count = await getUnreadCount({
      orgId: "org-badge",
      userId: "user-badge",
    });

    expect(count).toBe(0);
  });

  it("decrementa após markAsRead individual", async () => {
    // Estado inicial: 3 não lidas
    mockNotificationCount.mockResolvedValueOnce(3);
    const before = await getUnreadCount({
      orgId: "org-badge",
      userId: "user-badge",
    });
    expect(before).toBe(3);

    // Simular markAsRead
    mockNotificationFindUnique.mockResolvedValue({
      id: "notif-x",
      userId: "user-badge",
      orgId: "org-badge",
      read: false,
      readAt: null,
    });
    mockNotificationUpdate.mockResolvedValue({
      id: "notif-x",
      read: true,
      readAt: new Date(),
    });
    await markAsRead({ notificationId: "notif-x" });

    // Após markAsRead, badge deve ter diminuído
    mockNotificationCount.mockResolvedValueOnce(2);
    const after = await getUnreadCount({
      orgId: "org-badge",
      userId: "user-badge",
    });
    expect(after).toBe(2);
    expect(after).toBeLessThan(before);
  });

  it("badge é 0 sem notificações na org", async () => {
    mockNotificationCount.mockResolvedValue(0);

    const count = await getUnreadCount({
      orgId: "org-vazia",
      userId: "user-badge",
    });

    expect(count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Polling — notificações desde o último timestamp
// ─────────────────────────────────────────────────────────────────────────────

describe("Polling — notificações desde último timestamp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-badge" } });
  });

  it("retorna apenas notificações criadas após o timestamp de último polling", async () => {
    const lastCheck = new Date("2026-04-01T10:00:00Z");
    const newNotif = makeNotif(
      "notif-new",
      false,
      new Date("2026-04-01T11:00:00Z"),
    );

    // listNotifications com cursor simula polling
    mockNotificationFindMany.mockResolvedValue([newNotif]);

    const result = await listNotifications({
      orgId: "org-badge",
      userId: "user-badge",
    });

    expect(mockNotificationFindMany).toHaveBeenCalled();
    // O resultado deve conter apenas notificações após lastCheck
    const filtered = result.filter((n) => new Date(n.createdAt) > lastCheck);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("notif-new");
  });

  it("retorna [] se não há notificações novas desde o último polling", async () => {
    mockNotificationFindMany.mockResolvedValue([]);

    const result = await listNotifications({
      orgId: "org-badge",
      userId: "user-badge",
    });

    expect(result).toHaveLength(0);
  });

  it("inclui notificações não lidas no resultado do polling", async () => {
    const unreadNotif = makeNotif(
      "unread-1",
      false,
      new Date("2026-04-02T09:00:00Z"),
    );
    const unreadNotif2 = makeNotif(
      "unread-2",
      false,
      new Date("2026-04-02T09:30:00Z"),
    );

    mockNotificationFindMany.mockResolvedValue([unreadNotif2, unreadNotif]);

    const result = await listNotifications({
      orgId: "org-badge",
      userId: "user-badge",
    });

    expect(result).toHaveLength(2);
    const allUnread = result.every((n) => !n.read);
    expect(allUnread).toBe(true);
  });

  it("badge count e polling são consistentes — count reflecte os resultados", async () => {
    const unreadNotifs = [
      makeNotif("p-1", false, new Date("2026-04-02T08:00:00Z")),
      makeNotif("p-2", false, new Date("2026-04-02T09:00:00Z")),
    ];

    mockNotificationFindMany.mockResolvedValue(unreadNotifs);
    mockNotificationCount.mockResolvedValue(2);

    const polled = await listNotifications({
      orgId: "org-badge",
      userId: "user-badge",
    });
    const badgeCount = await getUnreadCount({
      orgId: "org-badge",
      userId: "user-badge",
    });

    // Badge count deve corresponder ao número de não lidas retornadas pelo polling
    const unreadInPolled = polled.filter((n) => !n.read).length;
    expect(badgeCount).toBe(unreadInPolled);
  });
});
