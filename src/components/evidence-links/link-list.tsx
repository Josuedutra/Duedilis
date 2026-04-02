"use client";

/**
 * LinkList — lista de entidades ligadas a uma entidade via links probatórios.
 * Usado em issue detail, doc detail, meeting detail.
 * Sprint D3, Task D3-04/05 (gov-1775077692551-w466q6)
 */

import { useEffect, useState, useCallback } from "react";

type EntityType = "Issue" | "Document" | "Photo" | "Meeting";

interface EvidenceLink {
  id: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  hash: string;
}

interface LinkListProps {
  orgId: string;
  entityType: EntityType;
  entityId: string;
  onCreateLink?: () => void;
}

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  Issue: "NC",
  Document: "Documento",
  Photo: "Foto",
  Meeting: "Reunião",
};

const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  Issue: "bg-red-100 text-red-700",
  Document: "bg-blue-100 text-blue-700",
  Photo: "bg-green-100 text-green-700",
  Meeting: "bg-purple-100 text-purple-700",
};

export function LinkList({
  orgId,
  entityType,
  entityId,
  onCreateLink,
}: LinkListProps) {
  const [links, setLinks] = useState<EvidenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/evidence-links?orgId=${orgId}&entityType=${entityType}&entityId=${entityId}`,
      );
      if (!res.ok) throw new Error("Erro ao carregar links probatórios.");
      const data = await res.json();
      setLinks(data.links ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, [orgId, entityType, entityId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const getLinkedEntityType = (link: EvidenceLink): EntityType => {
    return link.sourceType === entityType && link.sourceId === entityId
      ? link.targetType
      : link.sourceType;
  };

  const getLinkedEntityId = (link: EvidenceLink): string => {
    return link.sourceType === entityType && link.sourceId === entityId
      ? link.targetId
      : link.sourceId;
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-400 py-2">
        A carregar links probatórios...
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500 py-2">{error}</div>;
  }

  return (
    <div className="space-y-2">
      {links.length === 0 ? (
        <p className="text-sm text-gray-400 py-2 text-center">
          Nenhum link probatório.{" "}
          {onCreateLink && (
            <button
              onClick={onCreateLink}
              className="text-blue-600 hover:underline font-medium"
            >
              Ligar entidade
            </button>
          )}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {links.map((link) => {
              const linkedType = getLinkedEntityType(link);
              const linkedId = getLinkedEntityId(link);
              return (
                <li
                  key={link.id}
                  className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ENTITY_TYPE_COLORS[linkedType]}`}
                  >
                    {ENTITY_TYPE_LABELS[linkedType]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-gray-700 truncate">
                      {linkedId}
                    </p>
                    {link.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {link.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(link.createdAt).toLocaleDateString("pt-PT", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div
                    className="text-xs text-gray-300 font-mono truncate max-w-[80px]"
                    title={link.hash}
                  >
                    {link.hash.slice(0, 8)}…
                  </div>
                </li>
              );
            })}
          </ul>
          {onCreateLink && (
            <button
              onClick={() => {
                onCreateLink();
                fetchLinks();
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 block"
            >
              + Ligar entidade
            </button>
          )}
        </>
      )}
    </div>
  );
}
