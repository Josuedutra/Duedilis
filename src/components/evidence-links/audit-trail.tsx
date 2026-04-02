"use client";

/**
 * AuditTrail — timeline completa de uma entidade.
 * Mostra links probatórios + audit logs, ordenados por createdAt.
 * Sprint D3, Task D3-04/05 (gov-1775077692551-w466q6)
 */

import { useEffect, useState, useCallback } from "react";

interface LinkItem {
  type: "link";
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  hash: string;
}

interface AuditItem {
  type: "audit";
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  createdAt: string;
  hash: string;
  payload: Record<string, unknown> | null;
}

type TimelineItem = LinkItem | AuditItem;

interface AuditTrailProps {
  orgId: string;
  entityType: string;
  entityId: string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criado",
  UPDATE: "Actualizado",
  DELETE: "Eliminado",
  APPROVE: "Aprovado",
  REJECT: "Rejeitado",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 border-green-200",
  UPDATE: "bg-blue-100 text-blue-700 border-blue-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
  APPROVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REJECT: "bg-orange-100 text-orange-700 border-orange-200",
};

export function AuditTrail({ orgId, entityType, entityId }: AuditTrailProps) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/evidence-links/${entityType}/${entityId}/trail?orgId=${orgId}`,
      );
      if (!res.ok) throw new Error("Erro ao carregar audit trail.");
      const data = await res.json();
      setTimeline(data.timeline ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, [orgId, entityType, entityId]);

  useEffect(() => {
    fetchTrail();
  }, [fetchTrail]);

  if (loading) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        A carregar histórico...
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500 py-2">{error}</div>;
  }

  if (timeline.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        Sem histórico para esta entidade.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Timeline vertical line */}
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />

      <ul className="space-y-3 relative">
        {timeline.map((item) => {
          if (item.type === "link") {
            return (
              <li key={`link-${item.id}`} className="flex gap-4">
                <div className="shrink-0 w-7 h-7 rounded-full bg-purple-100 border-2 border-purple-300 flex items-center justify-center z-10">
                  <span className="text-xs text-purple-600">🔗</span>
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Link Probatório criado
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.sourceType}{" "}
                        <span className="text-gray-400">→</span>{" "}
                        {item.targetType}
                        {item.description && (
                          <span className="ml-2 text-gray-400 italic">
                            &quot;{item.description}&quot;
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString("pt-PT", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-gray-300 font-mono">
                        {item.hash.slice(0, 8)}…
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          }

          if (item.type === "audit") {
            const colorClass =
              ACTION_COLORS[item.action] ??
              "bg-gray-100 text-gray-600 border-gray-200";
            return (
              <li key={`audit-${item.id}`} className="flex gap-4">
                <div className="shrink-0 w-7 h-7 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center z-10">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorClass}`}
                        >
                          {ACTION_LABELS[item.action] ?? item.action}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.entityType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 font-mono truncate max-w-[200px]">
                        {item.entityId}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString("pt-PT", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-gray-300 font-mono">
                        {item.hash?.slice(0, 8) ?? ""}…
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          }

          return null;
        })}
      </ul>
    </div>
  );
}
