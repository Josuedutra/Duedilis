"use client";

/**
 * CreateLinkDialog — dialog para criar novo link probatório.
 * Seleciona tipo de entidade + ID da entidade alvo.
 * Sprint D3, Task D3-04/05 (gov-1775077692551-w466q6)
 */

import { useState } from "react";

type EntityType = "Issue" | "Document" | "Photo" | "Meeting";

interface CreateLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  orgId: string;
  projectId: string;
  sourceType: EntityType;
  sourceId: string;
}

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "Issue", label: "NC (Não Conformidade)" },
  { value: "Document", label: "Documento" },
  { value: "Photo", label: "Foto" },
  { value: "Meeting", label: "Reunião" },
];

export function CreateLinkDialog({
  open,
  onClose,
  onCreated,
  orgId,
  projectId,
  sourceType,
  sourceId,
}: CreateLinkDialogProps) {
  const [targetType, setTargetType] = useState<EntityType>("Photo");
  const [targetId, setTargetId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId.trim()) {
      setError("ID da entidade alvo é obrigatório.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/evidence-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          projectId,
          sourceType,
          sourceId,
          targetType,
          targetId: targetId.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao criar link.");
      }

      // Reset form
      setTargetId("");
      setDescription("");
      setTargetType("Photo");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Criar Link Probatório
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Source (read-only info) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Entidade Origem
            </label>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-xs font-medium text-gray-600">
                {sourceType}
              </span>
              <span className="text-xs font-mono text-gray-800">
                {sourceId}
              </span>
            </div>
          </div>

          {/* Target type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Tipo de Entidade Alvo
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as EntityType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target ID */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ID da Entidade Alvo
            </label>
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder={`ID da ${targetType}`}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Descrição{" "}
              <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Motivo do link probatório..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 px-4 py-2 rounded-lg font-medium"
            >
              {loading ? "A criar..." : "Criar Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
