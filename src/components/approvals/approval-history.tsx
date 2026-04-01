"use client";

/**
 * ApprovalHistory component — Sprint D2-07/08
 * Task: gov-1775041268972-jcae07
 *
 * Timeline de aprovações para um documento.
 * Mostra estado, quem, quando, nota (se rejeitado).
 */

interface ApprovalHistoryEntry {
  id: string;
  status: string;
  createdAt: string | Date;
  submitter: { id: string; name: string | null; email: string | null };
  reviewer: { id: string; name: string | null; email: string | null } | null;
  note?: string | null;
}

interface ApprovalHistoryProps {
  approvals: ApprovalHistoryEntry[];
  className?: string;
}

const STATUS_ICON: Record<string, string> = {
  PENDING_REVIEW: "⏳",
  APPROVED: "✅",
  REJECTED: "❌",
  CANCELLED: "🚫",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "Submetido para revisão",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  CANCELLED: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_REVIEW: "text-yellow-700",
  APPROVED: "text-green-700",
  REJECTED: "text-red-700",
  CANCELLED: "text-gray-500",
};

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApprovalHistory({
  approvals,
  className,
}: ApprovalHistoryProps) {
  if (approvals.length === 0) {
    return (
      <div className={`text-sm text-gray-500 py-4 ${className ?? ""}`}>
        Sem histórico de aprovações.
      </div>
    );
  }

  return (
    <ol
      className={`relative border-l border-gray-200 dark:border-gray-700 ${className ?? ""}`}
    >
      {approvals.map((entry) => {
        const icon = STATUS_ICON[entry.status] ?? "•";
        const label = STATUS_LABEL[entry.status] ?? entry.status;
        const colorClass = STATUS_COLOR[entry.status] ?? "text-gray-700";

        const actor = entry.reviewer ?? entry.submitter;
        const actorName = actor.name ?? actor.email ?? actor.id;

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
                <span className={`text-sm font-medium ${colorClass}`}>
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
                  {formatDate(entry.createdAt)}
                </time>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300">
                por{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {actorName}
                </span>
              </p>

              {entry.note && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
                  Motivo: {entry.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type { ApprovalHistoryEntry, ApprovalHistoryProps };
