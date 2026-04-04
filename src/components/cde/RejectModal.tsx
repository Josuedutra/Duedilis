"use client";

/**
 * RejectModal — Staging Area reject document modal
 * Task: gov-1775322240095-6ic9an (D4-11v2)
 *
 * Requires mandatory rejection reason before submitting.
 */

import { useState, useTransition } from "react";
import { rejectStaging } from "@/lib/actions/staging-quarantine";

interface RejectModalProps {
  stagingId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RejectModal({
  stagingId,
  isOpen,
  onClose,
  onSuccess,
}: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Motivo de rejeição é obrigatório.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await rejectStaging({ stagingId, reason });
        setReason("");
        onSuccess();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
      }
    });
  }

  function handleClose() {
    setReason("");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Rejeitar documento
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              disabled={isPending}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? "A rejeitar…" : "Rejeitar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
