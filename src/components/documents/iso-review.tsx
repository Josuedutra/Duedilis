"use client";

/**
 * IsoReview — UI de confirmação de nomes ISO 19650 sugeridos por IA
 * Task: gov-1775041253896-v20gul
 *
 * Mostra sugestão ISO ao lado do nome original.
 * Acções: Confirmar | Editar (manual) | Rejeitar
 * Confidence: badge verde ≥0.8, amarelo ≥0.5
 */

import { useState, useTransition } from "react";
import { transitionDocumentStatus } from "@/lib/actions/cde-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentForReview {
  id: string;
  originalName: string;
  isoName: string | null;
  discipline: string | null;
  docType: string | null;
  revision: string | null;
  status: string;
  confidence?: number | null;
}

interface Props {
  document: DocumentForReview;
  onConfirm?: (docId: string, isoName: string) => void;
  onReject?: (docId: string) => void;
}

// ─── Confidence Badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const colorClass =
    confidence >= 0.8
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-yellow-100 text-yellow-800 border-yellow-200";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}
    >
      {pct}% confiança
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IsoReview({ document, onConfirm, onReject }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [editedIsoName, setEditedIsoName] = useState(document.isoName ?? "");
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(document.status);

  // Document in READY state with an isoName suggestion
  const isReviewable = localStatus === "READY" && document.isoName !== null;

  function handleConfirm() {
    startTransition(async () => {
      await transitionDocumentStatus({
        documentId: document.id,
        toStatus: "CONFIRMED",
      });
      setLocalStatus("CONFIRMED");
      onConfirm?.(document.id, document.isoName!);
    });
  }

  function handleEditSave() {
    if (!editedIsoName.trim()) return;
    startTransition(async () => {
      await transitionDocumentStatus({
        documentId: document.id,
        toStatus: "CONFIRMED",
        isoName: editedIsoName.trim(),
      });
      setLocalStatus("CONFIRMED");
      setEditMode(false);
      onConfirm?.(document.id, editedIsoName.trim());
    });
  }

  function handleReject() {
    startTransition(async () => {
      await transitionDocumentStatus({
        documentId: document.id,
        toStatus: "REJECTED",
      });
      setLocalStatus("REJECTED");
      onReject?.(document.id);
    });
  }

  if (!isReviewable) {
    return null;
  }

  const confidence = document.confidence ?? 0;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-900">
          Sugestão ISO 19650
        </span>
        {confidence > 0 && <ConfidenceBadge confidence={confidence} />}
      </div>

      {/* Names comparison */}
      <div className="space-y-1.5">
        <div className="flex gap-2 items-start">
          <span className="text-xs text-slate-500 w-20 shrink-0 pt-0.5">
            Original
          </span>
          <span className="text-sm text-slate-700 font-mono break-all">
            {document.originalName}
          </span>
        </div>
        <div className="flex gap-2 items-start">
          <span className="text-xs text-slate-500 w-20 shrink-0 pt-0.5">
            ISO 19650
          </span>
          {editMode ? (
            <input
              type="text"
              value={editedIsoName}
              onChange={(e) => setEditedIsoName(e.target.value)}
              className="text-sm font-mono border border-blue-300 rounded px-2 py-0.5 bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="EX: PRJ-AR-DR-ZZ-0001-P01"
              autoFocus
            />
          ) : (
            <span className="text-sm text-blue-800 font-mono font-medium break-all">
              {document.isoName}
            </span>
          )}
        </div>

        {/* Discipline + DocType + Revision tags */}
        {(document.discipline || document.docType || document.revision) &&
          !editMode && (
            <div className="flex gap-1.5 flex-wrap pt-0.5">
              {document.discipline && (
                <span className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-700">
                  {document.discipline}
                </span>
              )}
              {document.docType && (
                <span className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-700">
                  {document.docType}
                </span>
              )}
              {document.revision && (
                <span className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-slate-600">
                  Rev. {document.revision}
                </span>
              )}
            </div>
          )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {editMode ? (
          <>
            <button
              onClick={handleEditSave}
              disabled={isPending || !editedIsoName.trim()}
              className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={() => {
                setEditMode(false);
                setEditedIsoName(document.isoName ?? "");
              }}
              disabled={isPending}
              className="px-3 py-1.5 text-sm font-medium rounded bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "A guardar…" : "Confirmar"}
            </button>
            <button
              onClick={() => setEditMode(true)}
              disabled={isPending}
              className="px-3 py-1.5 text-sm font-medium rounded bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={handleReject}
              disabled={isPending}
              className="px-3 py-1.5 text-sm font-medium rounded bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Rejeitar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
