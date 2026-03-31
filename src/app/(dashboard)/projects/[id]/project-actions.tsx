"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { archiveProject } from "@/lib/actions/project-actions";

interface Props {
  projectId: string;
  status: string;
}

export function ProjectActions({ projectId, status }: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  async function handleArchive() {
    setConfirming(false);
    setOpen(false);
    await archiveProject(projectId);
    router.refresh();
  }

  const isActive = status === "ATIVO";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
      >
        Ações
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
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setOpen(false);
              setConfirming(false);
            }}
          />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border shadow-lg z-20 py-1">
            <Link
              href={`/projects/${projectId}/edit`}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Editar
            </Link>
            {isActive && !confirming && (
              <button
                onClick={() => setConfirming(true)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8M10 12v4M14 12v4"
                  />
                </svg>
                Arquivar
              </button>
            )}
            {isActive && confirming && (
              <div className="px-4 py-2">
                <p className="text-xs text-gray-600 mb-2">
                  Confirmar arquivamento?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleArchive}
                    className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="flex-1 px-2 py-1 text-xs border rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
