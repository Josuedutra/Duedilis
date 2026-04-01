"use client";

/**
 * DocumentList — tabela de documentos CDE com paginação e side panel
 * Task: gov-1775041228837-pj6dba
 *
 * Colunas: Nome original | Nome ISO | Status | Versão | Data | Uploader
 * Filtro por status | Paginação 20/pág | Click → side panel com detalhes
 */

import { useState, useCallback } from "react";
import { transitionDocumentStatus } from "@/lib/actions/cde-actions";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  NORMALIZING: "A normalizar",
  READY: "Pronto",
  CONFIRMED: "Confirmado",
  REJECTED: "Rejeitado",
  SUPERSEDED: "Substituído",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  NORMALIZING: "bg-orange-100 text-orange-800",
  READY: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SUPERSEDED: "bg-gray-100 text-gray-500",
};

const ALL_STATUSES = [
  "PENDING",
  "NORMALIZING",
  "READY",
  "CONFIRMED",
  "REJECTED",
  "SUPERSEDED",
];

interface DocumentItem {
  id: string;
  originalName: string;
  isoName: string | null;
  status: string;
  revision: string | null;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  uploader: { name: string | null; email: string };
}

interface Props {
  initialDocuments: DocumentItem[];
  orgId?: string;
  folderId?: string;
}

export function DocumentList({ initialDocuments }: Props) {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const filtered =
    filterStatus === "ALL"
      ? documents
      : documents.filter((d) => d.status === filterStatus);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleTransition = useCallback(
    async (docId: string, toStatus: string) => {
      setTransitioning(docId);
      setTransitionError(null);
      try {
        const updated = await transitionDocumentStatus({
          documentId: docId,
          toStatus,
        });
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, status: updated.status } : d,
          ),
        );
        if (selectedDoc?.id === docId) {
          setSelectedDoc((prev) =>
            prev ? { ...prev, status: updated.status } : null,
          );
        }
      } catch (err) {
        setTransitionError(
          err instanceof Error ? err.message : "Erro na transição.",
        );
      } finally {
        setTransitioning(null);
      }
    },
    [selectedDoc],
  );

  return (
    <div className="flex gap-4">
      {/* Main table */}
      <div className="flex-1 min-w-0">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => {
              setFilterStatus("ALL");
              setPage(0);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === "ALL" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Todos ({documents.length})
          </button>
          {ALL_STATUSES.map((s) => {
            const count = documents.filter((d) => d.status === s).length;
            if (count === 0) return null;
            return (
              <button
                key={s}
                onClick={() => {
                  setFilterStatus(s);
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? "bg-gray-800 text-white" : `${STATUS_COLORS[s] ?? "bg-gray-100 text-gray-600"} hover:opacity-80`}`}
              >
                {STATUS_LABELS[s] ?? s} ({count})
              </button>
            );
          })}
        </div>

        {/* Table */}
        {paginated.length === 0 ? (
          <div className="bg-white rounded-xl border flex items-center justify-center py-16">
            <p className="text-sm text-gray-400">Sem documentos nesta pasta.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nome original
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nome ISO
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Versão
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Data
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Uploader
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() =>
                        setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)
                      }
                      className={`cursor-pointer transition-colors ${selectedDoc?.id === doc.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileIcon mimeType={doc.mimeType} />
                          <span className="font-medium text-gray-900 truncate max-w-48">
                            {doc.originalName}
                          </span>
                          {doc.revision && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                              {doc.revision}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono truncate max-w-40">
                        {doc.isoName ?? (
                          <span className="text-gray-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {STATUS_LABELS[doc.status] ?? doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {doc.revision ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(doc.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-28">
                        {doc.uploader.name ?? doc.uploader.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t px-4 py-3 flex items-center justify-between bg-gray-50">
                <p className="text-xs text-gray-500">
                  {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, filtered.length)} de{" "}
                  {filtered.length}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 text-xs border rounded-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1 text-xs border rounded-md disabled:opacity-40 hover:bg-gray-100 transition-colors"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Side panel */}
      {selectedDoc && (
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border p-5 sticky top-0">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 break-all pr-2">
                {selectedDoc.originalName}
              </h3>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <DetailRow label="Status">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedDoc.status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {STATUS_LABELS[selectedDoc.status] ?? selectedDoc.status}
                </span>
              </DetailRow>

              {selectedDoc.revision && (
                <DetailRow label="Revisão">
                  <span className="font-mono bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                    {selectedDoc.revision}
                  </span>
                </DetailRow>
              )}

              {selectedDoc.isoName && (
                <DetailRow label="Nome ISO">
                  <span className="font-mono text-gray-700 break-all">
                    {selectedDoc.isoName}
                  </span>
                </DetailRow>
              )}

              <DetailRow label="Tipo">{selectedDoc.mimeType}</DetailRow>
              <DetailRow label="Tamanho">
                {formatBytes(selectedDoc.fileSizeBytes)}
              </DetailRow>
              <DetailRow label="Data">
                {formatDate(selectedDoc.createdAt)}
              </DetailRow>
              <DetailRow label="Uploader">
                {selectedDoc.uploader.name ?? selectedDoc.uploader.email}
              </DetailRow>
            </div>

            {/* Transition actions */}
            <div className="mt-5 space-y-2">
              {transitionError && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">
                  {transitionError}
                </p>
              )}
              <TransitionActions
                status={selectedDoc.status}
                docId={selectedDoc.id}
                onTransition={handleTransition}
                isLoading={transitioning === selectedDoc.id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransitionActions({
  status,
  docId,
  onTransition,
  isLoading,
}: {
  status: string;
  docId: string;
  onTransition: (docId: string, toStatus: string) => void;
  isLoading: boolean;
}) {
  if (status === "READY") {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onTransition(docId, "CONFIRMED")}
          disabled={isLoading}
          className="w-full px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "A processar..." : "Confirmar nome ISO"}
        </button>
        <button
          onClick={() => onTransition(docId, "REJECTED")}
          disabled={isLoading}
          className="w-full px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
        >
          Rejeitar
        </button>
      </div>
    );
  }
  return null;
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-gray-400 uppercase tracking-wide text-[10px]">
        {label}
      </span>
      <span className="text-gray-700">{children}</span>
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 ${isPdf ? "text-red-400" : isImage ? "text-green-400" : "text-blue-400"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
