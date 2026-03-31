"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addProjectMember } from "@/lib/actions/membership-actions";

interface OrgMember {
  userId: string;
  name: string | null;
  email: string | null;
}

interface Props {
  projectId: string;
  orgMembers: OrgMember[];
}

const PROJECT_ROLES = [
  { value: "GESTOR_PROJETO", label: "Gestor" },
  { value: "FISCAL", label: "Fiscal" },
  { value: "TECNICO", label: "Técnico" },
  { value: "AUDITOR", label: "Auditor" },
  { value: "OBSERVADOR", label: "Observador" },
];

export function AddProjectMemberForm({ projectId, orgMembers }: Props) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("OBSERVADOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await addProjectMember({ projectId, userId, role });
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setUserId("");
        setRole("OBSERVADOR");
        router.refresh();
      }
    } catch {
      setError("Erro ao adicionar membro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 border-t pt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Adicionar membro
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Adicionar membro ao projeto
          </p>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar membro...</option>
              {orgMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name ?? m.email} {m.name ? `(${m.email})` : ""}
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PROJECT_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !userId}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "A adicionar..." : "Adicionar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
