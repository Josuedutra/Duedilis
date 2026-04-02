"use server";

/**
 * Meeting actions — Sprint D3
 * Task: gov-1775077672346-s5op4f (D3-02/03: Reuniões CRUD + participantes + Atas)
 *
 * Server actions: createMeeting, listMeetings, updateMeeting, cancelMeeting,
 *                 addParticipant, markAttendance, removeParticipant, listParticipants,
 *                 createMinutes, updateMinutes, publishMinutes, getMinutes,
 *                 createActionItem, assignActionItem, completeActionItem, listActionItems,
 *                 startMeeting, endMeeting
 *
 * Nota: Meeting model introduzido no D3-01-schema — usa (prisma as any) para
 * compatibilidade com schema em main que ainda não tem o modelo.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEntry } from "@/lib/services/audit-log";
import { Resend } from "resend";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "");
}

// ─── OrgRole permission helper ─────────────────────────────────────────────

const ROLES_ALLOWED_TO_CREATE = [
  "ADMIN_ORG",
  "GESTOR_PROJETO",
  "FISCAL",
  "TECNICO",
];

// ─────────────────────────────────────────────────────────────────────────────
// MEETING CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createMeeting(input: {
  orgId: string;
  projectId: string;
  title: string;
  scheduledAt: Date;
  location?: string;
  description?: string;
}): Promise<{
  id: string;
  orgId: string;
  projectId: string;
  title: string;
  status: string;
  createdById: string;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const membership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: { userId: session.user.id!, orgId: input.orgId },
    },
  });

  if (!membership || !ROLES_ALLOWED_TO_CREATE.includes(membership.role)) {
    throw new Error("403 Forbidden — sem permissão para criar reuniões.");
  }

  const meeting = await db.meeting.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      title: input.title,
      scheduledAt: input.scheduledAt,
      location: input.location ?? null,
      description: input.description ?? null,
      status: "AGENDADA",
      createdById: session.user.id!,
    },
  });

  await createAuditEntry({
    orgId: input.orgId,
    entityType: "Meeting",
    entityId: meeting.id,
    action: "MEETING_CREATE",
    userId: session.user.id!,
    payload: { title: input.title, projectId: input.projectId },
  });

  return meeting;
}

export async function listMeetings(input: {
  orgId: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
}): Promise<
  Array<{ id: string; orgId: string; projectId: string; status: string }>
> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  // RLS: verify membership
  const membership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: { userId: session.user.id!, orgId: input.orgId },
    },
  });
  if (!membership) return [];

  const where: Record<string, unknown> = { orgId: input.orgId };
  if (input.projectId) where.projectId = input.projectId;

  const take = input.pageSize ?? 20;
  const skip = ((input.page ?? 1) - 1) * take;

  return db.meeting.findMany({
    where,
    take,
    skip,
    orderBy: { scheduledAt: "asc" },
  });
}

export async function updateMeeting(input: {
  meetingId: string;
  title?: string;
  scheduledAt?: Date;
  location?: string;
  description?: string;
  status?: string;
}): Promise<{ id: string; title: string; location?: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const meeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
  });
  if (!meeting) throw new Error("Reunião não encontrada (404).");

  // Validate status transitions — CONCLUIDA is terminal
  if (input.status && meeting.status === "CONCLUIDA") {
    throw new Error(
      `Transição inválida — reunião CONCLUIDA é irreversível. Não é possível mover para ${input.status}.`,
    );
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.location !== undefined) data.location = input.location;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;

  return db.meeting.update({ where: { id: input.meetingId }, data });
}

export async function cancelMeeting(input: {
  meetingId: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const meeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
  });
  if (!meeting) throw new Error("Reunião não encontrada (404).");

  const updated = await db.meeting.update({
    where: { id: input.meetingId },
    data: { status: "CANCELADA" },
  });

  await createAuditEntry({
    orgId: meeting.orgId,
    entityType: "Meeting",
    entityId: input.meetingId,
    action: "MEETING_CANCEL",
    userId: session.user.id!,
    payload: { previousStatus: meeting.status },
  });

  return updated;
}

export async function startMeeting(input: {
  meetingId: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const meeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
  });
  if (!meeting) throw new Error("Reunião não encontrada (404).");

  const updated = await db.meeting.update({
    where: { id: input.meetingId },
    data: { status: "EM_CURSO" },
  });

  await createAuditEntry({
    orgId: meeting.orgId,
    entityType: "Meeting",
    entityId: input.meetingId,
    action: "MEETING_START_EM_CURSO",
    userId: session.user.id!,
    payload: { previousStatus: meeting.status },
  });

  return updated;
}

export async function endMeeting(input: {
  meetingId: string;
}): Promise<{ id: string; status: string; endedAt?: Date }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const meeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
  });
  if (!meeting) throw new Error("Reunião não encontrada (404).");

  const updated = await db.meeting.update({
    where: { id: input.meetingId },
    data: { status: "CONCLUIDA", endedAt: new Date() },
  });

  await createAuditEntry({
    orgId: meeting.orgId,
    entityType: "Meeting",
    entityId: input.meetingId,
    action: "MEETING_END",
    userId: session.user.id!,
    payload: { previousStatus: meeting.status },
  });

  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTICIPANTS
// ─────────────────────────────────────────────────────────────────────────────

export async function addParticipant(input: {
  meetingId: string;
  orgId: string;
  userId?: string;
  name: string;
  email?: string;
  role?: string;
}): Promise<{
  id: string;
  meetingId: string;
  userId: string | null;
  name: string;
  email: string | null;
  attended: boolean;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const meeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
  });
  if (!meeting) throw new Error("Reunião não encontrada (404).");

  return db.meetingParticipant.create({
    data: {
      meetingId: input.meetingId,
      orgId: input.orgId,
      userId: input.userId ?? null,
      name: input.name,
      email: input.email ?? null,
      role: input.role ?? null,
    },
  });
}

export async function markAttendance(input: {
  participantId: string;
  attended: boolean;
}): Promise<{ id: string; attended: boolean }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const participant = await db.meetingParticipant.findUnique({
    where: { id: input.participantId },
  });
  if (!participant) throw new Error("Participante não encontrado (404).");

  return db.meetingParticipant.update({
    where: { id: input.participantId },
    data: { attended: input.attended },
  });
}

export async function removeParticipant(input: {
  participantId: string;
}): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const participant = await db.meetingParticipant.findUnique({
    where: { id: input.participantId },
  });
  if (!participant) throw new Error("Participante não encontrado (404).");

  return db.meetingParticipant.delete({ where: { id: input.participantId } });
}

export async function listParticipants(input: {
  meetingId: string;
}): Promise<
  Array<{ id: string; meetingId: string; userId: string | null; name: string }>
> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  return db.meetingParticipant.findMany({
    where: { meetingId: input.meetingId },
    orderBy: { createdAt: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MEETING MINUTES (ATAS)
// ─────────────────────────────────────────────────────────────────────────────

export async function createMinutes(input: {
  meetingId: string;
  content: string;
}): Promise<{
  id: string;
  meetingId: string;
  orgId: string;
  content: string;
  publishedAt: Date | null;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const meeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
  });
  if (!meeting) throw new Error("Reunião não encontrada (404).");

  if (!["CONCLUIDA", "EM_CURSO"].includes(meeting.status)) {
    throw new Error(
      `Estado inválido — não pode criar ata para reunião ${meeting.status}. Reunião deve estar EM_CURSO ou CONCLUIDA.`,
    );
  }

  return db.meetingMinutes.create({
    data: {
      meetingId: input.meetingId,
      orgId: meeting.orgId,
      content: input.content,
    },
  });
}

export async function updateMinutes(input: {
  minutesId: string;
  content: string;
}): Promise<{ id: string; content: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const minutes = await db.meetingMinutes.findUnique({
    where: { id: input.minutesId },
  });
  if (!minutes) throw new Error("Ata não encontrada (404).");

  return db.meetingMinutes.update({
    where: { id: input.minutesId },
    data: { content: input.content },
  });
}

export async function publishMinutes(input: {
  minutesId: string;
}): Promise<{ id: string; publishedAt: Date; publishedById: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const minutes = await db.meetingMinutes.findUnique({
    where: { id: input.minutesId },
    include: { meeting: true },
  });
  if (!minutes) throw new Error("Ata não encontrada (404).");

  if (minutes.meeting?.status === "CANCELADA") {
    throw new Error("Proibido — não pode publicar ata de reunião CANCELADA.");
  }

  const updated = await db.meetingMinutes.update({
    where: { id: input.minutesId },
    data: {
      publishedAt: new Date(),
      publishedById: session.user.id!,
    },
  });

  // Send email to all participants with email via Resend
  try {
    const participants: Array<{ email: string | null; name: string }> =
      (await db.meetingParticipant.findMany({
        where: {
          meetingId: minutes.meetingId,
          email: { not: null },
        },
      })) ?? [];

    const recipientsWithEmail = participants.filter(
      (p): p is { email: string; name: string } => Boolean(p.email),
    );

    if (recipientsWithEmail.length > 0) {
      const resend = getResend();
      const meetingTitle = minutes.meeting?.title ?? "Reunião";
      const meetingId = minutes.meetingId;
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://app.duedilis.pt";

      await Promise.allSettled(
        recipientsWithEmail.map((p) =>
          resend.emails.send({
            from: "Duedilis <noreply@duedilis.pt>",
            to: p.email,
            subject: `[Duedilis] Ata publicada: ${meetingTitle}`,
            html: `<p>Olá ${p.name},</p><p>A ata da reunião <strong>${meetingTitle}</strong> foi publicada.</p><p><a href="${appUrl}/meetings/${meetingId}">Ver ata</a></p>`,
          }),
        ),
      );
    }
  } catch {
    // Non-fatal: email delivery failure shouldn't block publish
  }

  return updated;
}

export async function getMinutes(input: { meetingId: string }): Promise<{
  id: string;
  meetingId: string;
  content: string;
  publishedAt: Date | null;
  publishedById: string | null;
} | null> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  return db.meetingMinutes.findUnique({
    where: { meetingId: input.meetingId },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION ITEMS
// ─────────────────────────────────────────────────────────────────────────────

export async function createActionItem(input: {
  meetingId: string;
  orgId: string;
  description: string;
  assigneeId?: string;
  dueDate?: Date;
}): Promise<{
  id: string;
  meetingId: string;
  orgId: string;
  description: string;
  status: string;
  assigneeId: string | null;
  dueDate: Date | null;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const meeting = await db.meeting.findUnique({
    where: { id: input.meetingId },
  });
  if (!meeting) throw new Error("Reunião não encontrada (404).");

  return db.actionItem.create({
    data: {
      meetingId: input.meetingId,
      orgId: input.orgId,
      description: input.description,
      status: "PENDENTE",
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ?? null,
    },
  });
}

export async function assignActionItem(input: {
  actionItemId: string;
  assigneeId: string;
}): Promise<{ id: string; assigneeId: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const item = await db.actionItem.findUnique({
    where: { id: input.actionItemId },
  });
  if (!item) throw new Error("Action item não encontrado (404).");

  return db.actionItem.update({
    where: { id: input.actionItemId },
    data: { assigneeId: input.assigneeId },
  });
}

export async function completeActionItem(input: {
  actionItemId: string;
}): Promise<{ id: string; status: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const item = await db.actionItem.findUnique({
    where: { id: input.actionItemId },
  });
  if (!item) throw new Error("Action item não encontrado (404).");

  return db.actionItem.update({
    where: { id: input.actionItemId },
    data: { status: "CONCLUIDO" },
  });
}

export async function listActionItems(input: {
  meetingId?: string;
  orgId?: string;
}): Promise<
  Array<{
    id: string;
    meetingId: string;
    status: string;
    dueDate: Date | null;
  }>
> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const where: Record<string, unknown> = {};
  if (input.meetingId) where.meetingId = input.meetingId;
  if (input.orgId) where.orgId = input.orgId;

  return db.actionItem.findMany({
    where,
    orderBy: { dueDate: "asc" },
  });
}
