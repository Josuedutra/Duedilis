"use client";

import { useState, useTransition } from "react";
import { removeOrgMember } from "@/lib/actions/membership-actions";
import { useRouter } from "next/navigation";

const ROLE_LABELS: Record<string, string> = {
  ADMIN_ORG: "Admin",
  GESTOR_PROJETO: "Gestor",
  FISCAL: "Fiscal",
  TECNICO: "Técnico",
  AUDITOR: "Auditor",
  OBSERVADOR: "Observador",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN_ORG: "bg-purple-100 text-purple-700",
  GESTOR_PROJETO: "bg-blue-100 text-blue-700",
  FISCAL: "bg-green-100 text-green-700",
  TECNICO: "bg-orange-100 text-orange-700",
  AUDITOR: "bg-yellow-100 text-yellow-700",
  OBSERVADOR: "bg-gray-100 text-gray-600",
};

interface Member {
  id: string;
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  joinedAt: Date;
  isCurrentUser: boolean;
}

interface Props {
  members: Member[];
  isAdmin: boolean;
}

export function MembersList({ members, isAdmin }: Props) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleRemove(userId: string) {
    setRemovingId(userId);
    startTransition(async () => {
      try {
        await removeOrgMember(userId);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao remover membro.");
      } finally {
        setRemovingId(null);
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50">
        <p className="text-sm font-medium text-gray-600">
          {members.length} {members.length === 1 ? "membro" : "membros"}
        </p>
      </div>
      <div className="divide-y">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between px-5 py-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center uppercase select-none">
                {(m.name ?? m.email ?? "?")[0]}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900">
                    {m.name ?? m.email}
                  </p>
                  {m.isCurrentUser && (
                    <span className="text-xs text-gray-400">(eu)</span>
                  )}
                </div>
                {m.name && <p className="text-xs text-gray-500">{m.email}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"}`}
              >
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
              {isAdmin && !m.isCurrentUser && (
                <button
                  onClick={() => handleRemove(m.userId)}
                  disabled={removingId === m.userId}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Remover membro"
                >
                  {removingId === m.userId ? (
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
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
                        d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
                      />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
