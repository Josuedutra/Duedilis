"use client";

/**
 * ApprovalsQueueClient — Sprint D2-07/08
 * Task: gov-1775041268972-jcae07
 *
 * Tabela de aprovações com filtros e acções (aprovar/rejeitar/ver documento).
 */

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  approveDocument,
  rejectApproval,
  cancelApproval,
} from "@/lib/actions/approval-actions";

interface ApprovalEntry {
  id: string;
  status: string;
  createdAt: string;
  document: {
    id: string;
    originalName: string;
    isoName: string | null;
    status: string;
  };
  submitter: { id: string; name: string | null; email: string | null };
  reviewer: { id: string; name: string | null; email: string | null } | null;
}

interface Props {
  project: { id: string; name: string; orgId: string };
  initialApprovals: ApprovalEntry[];
  currentUserId: string;
  statusFilter: string;
}

const STATUS_TABS = [
  { key: "PENDING_REVIEW", label: "Pendentes" },
  { key: "APPROVED", label: "Aprovadas" },
  { key: "REJECTED", label: "Rejeitadas" },
  { key: "ALL", label: "Todas" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  CANCELLED: "Cancelado",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApprovalsQueueClient({
  project,
  initialApprovals,
  currentUserId,
  statusFilter,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [rejectModal, setRejectModal] = useState<{
    approvalId: string;
    docName: string;
  } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [actionError, setActionError] = useState("");

  function switchTab(status: string) {
    startTransition(() => {
      router.push(`${pathname}?status=${status}`);
    });
  }

  async function handleApprove(approvalId: string) {
    setActionError("");
    try {
      await approveDocument({ approvalId });
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao aprovar.");
    }
  }

  async function handleRejectSubmit() {
    if (!rejectModal) return;
    if (!rejectNote.trim()) {
      setRejectError("O motivo da rejeição é obrigatório.");
      return;
    }
    setRejectError("");
    try {
      await rejectApproval({
        approvalId: rejectModal.approvalId,
        note: rejectNote,
      });
      setRejectModal(null);
      setRejectNote("");
      router.refresh();
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : "Erro ao rejeitar.");
    }
  }

  async function handleCancel(approvalId: string) {
    setActionError("");
    try {
      await cancelApproval({ approvalId });
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao cancelar.");
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Aprovações</h1>
        <p className="text-sm text-gray-500 mt-1">{project.name}</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            disabled={isPending}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Table */}
      {initialApprovals.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          Nenhuma aprovação encontrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submetido por
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acções
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {initialApprovals.map((approval) => {
                const docName =
                  approval.document.isoName ?? approval.document.originalName;
                const submitterName =
                  approval.submitter.name ??
                  approval.submitter.email ??
                  approval.submitter.id;
                const isSubmitter = approval.submitter.id === currentUserId;
                const isPendingStatus = approval.status === "PENDING_REVIEW";

                return (
                  <tr key={approval.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className="text-sm font-medium text-gray-900 truncate max-w-xs block"
                        title={docName}
                      >
                        {docName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {submitterName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(approval.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[approval.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {STATUS_LABELS[approval.status] ?? approval.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Ver documento */}
                        <a
                          href={`/projects/${project.id}/documents?documentId=${approval.document.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver
                        </a>

                        {isPendingStatus && (
                          <>
                            {/* Aprovar */}
                            <button
                              onClick={() => handleApprove(approval.id)}
                              className="rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                            >
                              Aprovar
                            </button>

                            {/* Rejeitar */}
                            <button
                              onClick={() => {
                                setRejectNote("");
                                setRejectError("");
                                setRejectModal({
                                  approvalId: approval.id,
                                  docName,
                                });
                              }}
                              className="rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            >
                              Rejeitar
                            </button>

                            {/* Cancelar — só pelo submitter */}
                            {isSubmitter && (
                              <button
                                onClick={() => handleCancel(approval.id)}
                                className="rounded px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                              >
                                Cancelar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Rejeitar documento
            </h2>
            <p className="text-sm text-gray-500 mb-4 truncate">
              {rejectModal.docName}
            </p>

            <label
              htmlFor="reject-note"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Motivo da rejeição <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reject-note"
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Descreva o motivo da rejeição..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {rejectError && (
              <p className="mt-1 text-xs text-red-600">{rejectError}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectNote("");
                  setRejectError("");
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectSubmit}
                className="rounded-md px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
