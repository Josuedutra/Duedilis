"use client";

/**
 * StagingList — Staging Area document list with validate/promote/reject actions
 * Task: gov-1775322240095-6ic9an (D4-11v2)
 */

import { useState, useTransition } from "react";
import {
  getStagingStatusBadgeConfig,
  canValidateStaging,
  canPromoteStaging,
  canRejectStaging,
  suggestMetadataFromFilename,
  validateStaging,
  promoteStaging,
} from "@/lib/actions/staging-quarantine";
import {
  getStagingStatusBadgeConfig,
  canValidateStaging,
  canPromoteStaging,
  canRejectStaging,
  suggestMetadataFromFilename,
} from "@/lib/status-badges";
import { RejectModal } from "./RejectModal";

interface StagingDocument {
  id: string;
  originalName: string;
  isoName: string | null;
  status: string;
  uploadedAt: string;
  rejectionReason?: string | null;
}

interface StagingListProps {
  documents: StagingDocument[];
  onRefresh?: () => void;
}

const VARIANT_CLASSES: Record<string, string> = {
  warning: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  default: "bg-gray-100 text-gray-600 border border-gray-300",
  success: "bg-green-100 text-green-800 border border-green-300",
  error: "bg-red-100 text-red-800 border border-red-300",
};

function StatusBadge({ status }: { status: string }) {
  const config = getStagingStatusBadgeConfig(status);
  const cls = VARIANT_CLASSES[config.variant] ?? VARIANT_CLASSES.default;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {config.label}
    </span>
  );
}

function StagingRow({
  doc,
  onAction,
}: {
  doc: StagingDocument;
  onAction: (action: "validate" | "promote" | "reject", id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const suggestion = suggestMetadataFromFilename(doc.originalName);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="font-medium text-sm text-gray-900">
          {doc.originalName}
        </div>
        {doc.isoName && (
          <div className="text-xs text-gray-400">{doc.isoName}</div>
        )}
        {(suggestion.discipline || suggestion.docType) && (
          <div className="text-xs text-blue-600 mt-0.5">
            {suggestion.discipline && (
              <span className="mr-2">Disciplina: {suggestion.discipline}</span>
            )}
            {suggestion.docType && <span>Tipo: {suggestion.docType}</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={doc.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {new Date(doc.uploadedAt).toLocaleDateString("pt-PT")}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {canValidateStaging(doc.status) && (
            <button
              onClick={() =>
                startTransition(async () => {
                  await validateStaging({ stagingId: doc.id });
                  onAction("validate", doc.id);
                })
              }
              disabled={isPending}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Validate
            </button>
          )}
          {canPromoteStaging(doc.status) && (
            <button
              onClick={() =>
                startTransition(async () => {
                  await promoteStaging({ stagingId: doc.id });
                  onAction("promote", doc.id);
                })
              }
              disabled={isPending}
              className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
            >
              Promote
            </button>
          )}
          {canRejectStaging(doc.status) && (
            <button
              onClick={() => onAction("reject", doc.id)}
              disabled={isPending}
              className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function StagingList({ documents, onRefresh }: StagingListProps) {
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [docs, setDocs] = useState<StagingDocument[]>(documents);

  function handleAction(action: "validate" | "promote" | "reject", id: string) {
    if (action === "reject") {
      setRejectTarget(id);
    } else {
      onRefresh?.();
    }
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Sem documentos em quarentena.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documento
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Upload
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acções
              </th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <StagingRow key={doc.id} doc={doc} onAction={handleAction} />
            ))}
          </tbody>
        </table>
      </div>

      <RejectModal
        stagingId={rejectTarget ?? ""}
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onSuccess={() => {
          setDocs((prev) =>
            prev.map((d) =>
              d.id === rejectTarget ? { ...d, status: "REJECTED" } : d,
            ),
          );
          onRefresh?.();
        }}
      />
    </>
  );
}
