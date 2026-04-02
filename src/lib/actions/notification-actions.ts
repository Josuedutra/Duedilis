"use server";

/**
 * Notification actions — Sprint D3, Tasks D3-06/07
 * (gov-1775086316439-15imdk)
 *
 * Módulo 9: Notificações in-app + Outbox (email/WhatsApp delivery pipeline)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { sendWhatsAppNotification } from "@/lib/services/notification-whatsapp";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "");
}

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | "ISSUE_CREATED"
  | "ISSUE_ASSIGNED"
  | "ISSUE_STATUS_CHANGED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_DECIDED"
  | "MEETING_SCHEDULED"
  | "MEETING_MINUTES_PUBLISHED"
  | "ACTION_ITEM_ASSIGNED"
  | "ACTION_ITEM_DUE"
  | "DOCUMENT_UPLOADED"
  | "EVIDENCE_LINK_CREATED";

interface CreateNotificationInput {
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

interface ListNotificationsInput {
  orgId: string;
  userId: string;
  limit?: number;
  cursor?: string;
}

interface UnreadCountInput {
  orgId: string;
  userId: string;
}

interface MarkAsReadInput {
  notificationId: string;
}

interface MarkAllAsReadInput {
  orgId: string;
  userId: string;
}

interface EnqueueEmailInput {
  orgId: string;
  recipientId: string;
  subject: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

interface EnqueueWhatsAppInput {
  orgId: string;
  recipientId: string;
  body: string;
  entityType?: string;
  entityId?: string;
}

interface DeliverEmailInput {
  outboxId: string;
}

// ─── In-app Notifications ─────────────────────────────────────────────────────

/**
 * Cria uma notificação in-app.
 * Idempotente: se já existir uma notificação para o mesmo
 * userId + orgId + type + entityType + entityId, retorna a existente.
 */
export async function createNotification(input: CreateNotificationInput) {
  // Idempotency check: mesma combinação userId+orgId+type+entityId não duplica
  if (input.entityType && input.entityId) {
    const existing = await prisma.notification.findFirst({
      where: {
        orgId: input.orgId,
        userId: input.userId,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
    if (existing) return existing;
  }

  return prisma.notification.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
      read: false,
      readAt: null,
    },
  });
}

/**
 * Lista notificações de um utilizador numa org (RLS: apenas as próprias).
 * Se o userId pedido não corresponde ao utilizador autenticado,
 * retorna array vazio (RLS).
 */
export async function listNotifications(input: ListNotificationsInput) {
  const session = await auth();
  const requesterId = session?.user?.id;

  // RLS: apenas pode ver as próprias notificações
  if (requesterId && requesterId !== input.userId) {
    // Verificar se é admin da org
    const membership = await prisma.orgMembership.findUnique({
      where: {
        userId_orgId: { userId: requesterId, orgId: input.orgId },
      },
    });
    if (!membership || membership.role !== "ADMIN_ORG") {
      return [];
    }
  }

  return prisma.notification.findMany({
    where: {
      orgId: input.orgId,
      userId: input.userId,
    },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 50,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });
}

/**
 * Retorna a contagem de notificações não lidas.
 */
export async function getUnreadCount(input: UnreadCountInput): Promise<number> {
  return prisma.notification.count({
    where: {
      orgId: input.orgId,
      userId: input.userId,
      read: false,
    },
  });
}

/**
 * Marca uma notificação como lida.
 */
export async function markAsRead(input: MarkAsReadInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const notification = await prisma.notification.findUnique({
    where: { id: input.notificationId },
  });
  if (!notification) throw new Error("Notificação não encontrada.");

  // RLS: apenas o próprio utilizador pode marcar como lida
  if (notification.userId !== session.user.id) {
    throw new Error("403: sem permissão para marcar esta notificação.");
  }

  return prisma.notification.update({
    where: { id: input.notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

/**
 * Marca todas as notificações não lidas de um utilizador como lidas.
 */
export async function markAllAsRead(input: MarkAllAsReadInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  return prisma.notification.updateMany({
    where: {
      orgId: input.orgId,
      userId: input.userId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

// ─── Outbox (email/WhatsApp delivery pipeline) ────────────────────────────────

/**
 * Enfileira um email para entrega.
 * Idempotente: se já existir uma entrada PENDING/PROCESSING para o mesmo
 * recipientId + entityType + entityId + channel, retorna a existente.
 */
export async function enqueueEmail(input: EnqueueEmailInput) {
  // Idempotency check
  if (input.entityType && input.entityId) {
    const existing = await prisma.notificationOutbox.findFirst({
      where: {
        recipientId: input.recipientId,
        channel: "EMAIL",
        entityType: input.entityType,
        entityId: input.entityId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });
    if (existing) return existing;
  }

  return prisma.notificationOutbox.create({
    data: {
      orgId: input.orgId,
      recipientId: input.recipientId,
      channel: "EMAIL",
      subject: input.subject,
      body: input.body,
      status: "PENDING",
      attempts: 0,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
}

/**
 * Enfileira uma mensagem WhatsApp para entrega.
 * Idempotente: mesma lógica que enqueueEmail.
 */
export async function enqueueWhatsApp(input: EnqueueWhatsAppInput) {
  // Idempotency check
  if (input.entityType && input.entityId) {
    const existing = await prisma.notificationOutbox.findFirst({
      where: {
        recipientId: input.recipientId,
        channel: "WHATSAPP",
        entityType: input.entityType,
        entityId: input.entityId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });
    if (existing) return existing;
  }

  return prisma.notificationOutbox.create({
    data: {
      orgId: input.orgId,
      recipientId: input.recipientId,
      channel: "WHATSAPP",
      body: input.body,
      status: "PENDING",
      attempts: 0,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
}

/**
 * Processa o outbox: pega entradas PENDING e FAILED (attempts < 3),
 * transita para PROCESSING, e tenta entrega.
 */
export async function processOutbox() {
  const entries = await prisma.notificationOutbox.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        {
          status: "FAILED",
          attempts: { lt: 3 },
        },
      ],
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  for (const entry of entries) {
    // Attempt delivery and update status in a single DB round-trip (no intermediate PROCESSING update)
    try {
      if (entry.channel === "EMAIL") {
        await getResend().emails.send({
          from: "Duedilis <notificacoes@duedilis.pt>",
          to: entry.recipientId,
          subject: entry.subject ?? "Notificação Duedilis",
          html: entry.body,
        });
      } else if (entry.channel === "WHATSAPP") {
        await sendWhatsAppNotification({
          phone: entry.recipientId,
          message: entry.body,
        });
      }

      await prisma.notificationOutbox.update({
        where: { id: entry.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          lastAttemptAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.notificationOutbox.update({
        where: { id: entry.id },
        data: {
          status: "FAILED",
          errorMessage: message,
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    }
  }
}

/**
 * Tenta entregar um email de uma entrada específica do outbox.
 */
export async function deliverEmail(input: DeliverEmailInput) {
  const entry = await prisma.notificationOutbox.findFirst({
    where: { id: input.outboxId },
    include: { recipient: true },
  });
  if (!entry) throw new Error("Outbox entry não encontrada.");

  const recipientEmail =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (entry as any).recipient?.email ?? entry.recipientId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipientName = (entry as any).recipient?.name;

  try {
    await getResend().emails.send({
      from: "Duedilis <notificacoes@duedilis.pt>",
      to: recipientName
        ? `${recipientName} <${recipientEmail}>`
        : recipientEmail,
      subject: entry.subject ?? "Notificação Duedilis",
      html: entry.body,
    });

    return prisma.notificationOutbox.update({
      where: { id: input.outboxId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const newAttempts = entry.attempts + 1;
    return prisma.notificationOutbox.update({
      where: { id: input.outboxId },
      data: {
        status: "FAILED",
        errorMessage: message,
        attempts: newAttempts,
      },
    });
  }
}
