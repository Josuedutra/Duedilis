"use client";

/**
 * CreateFolderModal — cria nova pasta CDE (root ou sub-pasta)
 * Task: gov-1775041228837-pj6dba
 */

import { useState, useRef, useEffect } from "react";
import { createCdeFolder } from "@/lib/actions/cde-actions";

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
}

interface Props {
  orgId: string;
  projectId: string;
  folders: Folder[];
  onCreated: (folder: Folder) => void;
  onClose: () => void;
}

export function CreateFolderModal({
  orgId,
  projectId,
  folders,
  onCreated,
  onClose,
}: Props) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const folder = await createCdeFolder({
        orgId,
        projectId,
        name: name.trim(),
        parentId: parentId || null,
      });
      onCreated(folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar pasta.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Nova pasta
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da pasta
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Plantas Técnicas"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pasta pai (opcional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={isLoading}
            >
              <option value="">Raiz (sem pasta pai)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "A criar..." : "Criar pasta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
