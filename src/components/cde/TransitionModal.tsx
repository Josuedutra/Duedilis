"use client";

/**
 * TransitionModal — CDE lifecycle transition modal
 * Task: gov-1775322234055-de2m1o (D4-10v2)
 *
 * Opens when user clicks LifecycleBadge.
 * Shows only valid transitions for current status.
 * Reason field is mandatory.
 */

import { useState, useTransition } from "react";
import { getCdeStatusBadgeConfig } from "@/lib/cde-status";
import {
  CDE_VALID_TRANSITIONS,
  transitionCdeDocLifecycle,
} from "@/lib/actions/cde-actions";

interface TransitionModalProps {
  documentId: string;
  currentStatus: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStatus: string) => void;
}

export function TransitionModal({
  documentId,
  currentStatus,
  isOpen,
  onClose,
  onSuccess,
}: TransitionModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const validTransitions = CDE_VALID_TRANSITIONS[currentStatus] ?? [];

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStatus) {
      setError("Selecione o estado de destino.");
      return;
    }
    if (!reason.trim()) {
      setError("Motivo é obrigatório.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await transitionCdeDocLifecycle({
          documentId,
          toStatus: selectedStatus,
          reason,
        });
        onSuccess(selectedStatus);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Transitar estado do documento
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Estado actual:{" "}
          <strong>{getCdeStatusBadgeConfig(currentStatus).label}</strong>
        </p>

        {validTransitions.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">
            Este documento está em estado terminal — sem transições disponíveis.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Novo estado
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isPending}
              >
                <option value="">Selecione…</option>
                {validTransitions.map((s) => (
                  <option key={s} value={s}>
                    {getCdeStatusBadgeConfig(s).label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Descreva o motivo da transição…"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                disabled={isPending}
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isPending}
              >
                {isPending ? "A transitar…" : "Confirmar"}
              </button>
            </div>
          </form>
        )}

        {validTransitions.length === 0 && (
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
