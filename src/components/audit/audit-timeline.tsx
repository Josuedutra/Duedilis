"use client";

/**
 * AuditTimeline component — Sprint D2
 * Task: gov-1775041316173-u4jhw6
 *
 * Timeline vertical com entries do AuditLog.
 * Cada entry: ícone por action, username, timestamp, payload summary.
 */

import type { AuditEntityType, AuditAction } from "@/lib/services/audit-log";

interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  payload: Record<string, unknown> | null;
  createdAt: string | Date;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface AuditTimelineProps {
  entries: AuditEntry[];
  className?: string;
}

const ACTION_ICONS: Record<string, string> = {
  CREATE: "➕",
  UPDATE: "✏️",
  DELETE: "🗑️",
  TRANSITION: "🔄",
  APPROVE: "✅",
  REJECT: "❌",
  CANCEL: "🚫",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criado",
  UPDATE: "Actualizado",
  DELETE: "Eliminado",
  TRANSITION: "Transição",
  APPROVE: "Aprovado",
  REJECT: "Rejeitado",
  CANCEL: "Cancelado",
};

function formatTimestamp(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPayloadSummary(
  action: string,
  payload: Record<string, unknown> | null,
): string | null {
  if (!payload) return null;
  if (action === "TRANSITION" && payload.fromStatus && payload.toStatus) {
    return `${payload.fromStatus} → ${payload.toStatus}`;
  }
  if (action === "REJECT" && payload.note) {
    return `Motivo: ${payload.note}`;
  }
  if (action === "CREATE" && payload.originalName) {
    return `${payload.originalName}`;
  }
  return null;
}

export function AuditTimeline({ entries, className }: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className={`text-sm text-gray-500 py-4 ${className ?? ""}`}>
        Sem entradas no audit log.
      </div>
    );
  }

  return (
    <ol
      className={`relative border-l border-gray-200 dark:border-gray-700 ${className ?? ""}`}
    >
      {entries.map((entry) => {
        const icon = ACTION_ICONS[entry.action] ?? "•";
        const label = ACTION_LABELS[entry.action] ?? entry.action;
        const displayName =
          entry.user?.name ?? entry.user?.email ?? entry.userId;
        const payloadSummary = formatPayloadSummary(
          entry.action,
          entry.payload,
        );

        return (
          <li key={entry.id} className="mb-6 ml-6 last:mb-0">
            <span
              className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white dark:bg-gray-900 dark:ring-gray-900"
              aria-hidden="true"
            >
              <span className="text-sm leading-none" title={label}>
                {icon}
              </span>
            </span>

            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-600 dark:bg-gray-700">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {label}
                </span>
                <time
                  className="text-xs text-gray-500 dark:text-gray-400"
                  dateTime={
                    typeof entry.createdAt === "string"
                      ? entry.createdAt
                      : entry.createdAt.toISOString()
                  }
                >
                  {formatTimestamp(entry.createdAt)}
                </time>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300">
                por{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {displayName}
                </span>
              </p>

              {payloadSummary && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                  {payloadSummary}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type { AuditTimelineProps, AuditEntry, AuditEntityType, AuditAction };
