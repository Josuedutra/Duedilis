/**
 * Email notification service — Sprint D3, Task D3-08/08b
 * (gov-1775077739600-6nyr2k)
 *
 * Responsible for sending transactional emails via Resend SDK.
 */

import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "");
}

const FROM_EMAIL =
  process.env.NOTIFICATION_FROM_EMAIL ?? "notificacoes@duedilis.pt";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | "MEETING_MINUTES_PUBLISHED"
  | "APPROVAL_REQUESTED"
  | "ISSUE_CRITICAL"
  | "ACTION_ITEM_DUE"
  | string;

// ─── Email Sending ────────────────────────────────────────────────────────────

/**
 * Envia um email transacional via Resend SDK.
 * Retorna o messageId do Resend para rastreabilidade.
 */
export async function sendNotificationEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const resend = getResend();
  const result = await resend.emails.send({
    from: `Duedilis <${FROM_EMAIL}>`,
    to: input.to,
    subject: input.subject,
    html: input.body,
  });
  return { id: (result as { id?: string }).id ?? "" };
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Renderiza um template HTML para o tipo de notificação dado.
 * Retorna HTML inline pronto para enviar via Resend.
 */
export function renderEmailTemplate(input: {
  type: NotificationType;
  data: Record<string, unknown>;
}): string {
  const { type, data } = input;

  switch (type) {
    case "MEETING_MINUTES_PUBLISHED":
      return renderMeetingMinutesPublished(data);
    case "APPROVAL_REQUESTED":
      return renderApprovalRequested(data);
    case "ISSUE_CRITICAL":
      return renderIssueCritical(data);
    case "ACTION_ITEM_DUE":
      return renderActionItemDue(data);
    default:
      return renderGeneric(data);
  }
}

// ─── Template Implementations ─────────────────────────────────────────────────

function renderMeetingMinutesPublished(data: Record<string, unknown>): string {
  const title = String(data.title ?? "Reunião");
  const date = String(data.date ?? "");
  const link = String(data.link ?? "#");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Ata Publicada — ${title}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a2e">Ata publicada: ${title}</h2>
  ${date ? `<p style="color:#555">Data: ${date}</p>` : ""}
  <p>A ata da reunião está disponível para consulta.</p>
  <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Ver Ata</a>
  <p style="color:#999;font-size:12px;margin-top:32px">Duedilis — Gestão ISO</p>
</body>
</html>`;
}

function renderApprovalRequested(data: Record<string, unknown>): string {
  const document = String(data.document ?? "Documento");
  const submitter = String(data.submitter ?? "");
  const link = String(data.link ?? "#");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Aprovação Solicitada — ${document}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a2e">Aprovação necessária: ${document}</h2>
  ${submitter ? `<p style="color:#555">Submetido por: <strong>${submitter}</strong></p>` : ""}
  <p>O documento aguarda a sua aprovação.</p>
  <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Aprovar / Rejeitar</a>
  <p style="color:#999;font-size:12px;margin-top:32px">Duedilis — Gestão ISO</p>
</body>
</html>`;
}

function renderIssueCritical(data: Record<string, unknown>): string {
  const title = String(data.title ?? "NC Crítica");
  const project = String(data.project ?? "");
  const link = String(data.link ?? "#");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>NC Crítica — ${title}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#dc2626">NC Crítica: ${title}</h2>
  ${project ? `<p style="color:#555">Projecto: <strong>${project}</strong></p>` : ""}
  <p>Esta não-conformidade crítica requer atenção imediata.</p>
  <a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Ver NC</a>
  <p style="color:#999;font-size:12px;margin-top:32px">Duedilis — Gestão ISO</p>
</body>
</html>`;
}

function renderActionItemDue(data: Record<string, unknown>): string {
  const description = String(data.description ?? "Action item");
  const dueDate = String(data.dueDate ?? "");
  const link = String(data.link ?? "#");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Prazo a expirar — ${description}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#d97706">Prazo a expirar: ${description}</h2>
  ${dueDate ? `<p style="color:#555">Data limite: <strong>${dueDate}</strong></p>` : ""}
  <p>O prazo para conclusão desta tarefa está a aproximar-se.</p>
  <a href="${link}" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Ver Tarefa</a>
  <p style="color:#999;font-size:12px;margin-top:32px">Duedilis — Gestão ISO</p>
</body>
</html>`;
}

function renderGeneric(data: Record<string, unknown>): string {
  const title = String(data.title ?? "Notificação Duedilis");
  const body = String(data.body ?? "Tens uma nova notificação.");
  const link = String(data.link ?? "#");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1a1a2e">${title}</h2>
  <p>${body}</p>
  <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Ver detalhe</a>
  <p style="color:#999;font-size:12px;margin-top:32px">Duedilis — Gestão ISO</p>
</body>
</html>`;
}
