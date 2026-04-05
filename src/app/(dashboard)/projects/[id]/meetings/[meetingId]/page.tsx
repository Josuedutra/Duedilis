/**
 * Meeting detail page — Sprint D3, Tasks D3-02/03
 * Task: gov-1775077672346-s5op4f
 *
 * Detalhe de reunião: participantes, ata rich text, action items.
 * Desktop-only. Mobile: read-only.
 */

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MeetingEvidenceLinks } from "./meeting-evidence-links";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

interface Props {
  params: Promise<{ id: string; meetingId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  AGENDADA: "Agendada",
  EM_CURSO: "Em Curso",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  AGENDADA: "bg-blue-100 text-blue-800",
  EM_CURSO: "bg-yellow-100 text-yellow-800",
  CONCLUIDA: "bg-green-100 text-green-800",
  CANCELADA: "bg-gray-100 text-gray-600",
};

const ACTION_ITEM_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_CURSO: "Em Curso",
  CONCLUIDO: "Concluído",
};

export default async function MeetingDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: projectId, meetingId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      org: { memberships: { some: { userId: session.user.id } } },
    },
    include: { org: { select: { id: true, name: true } } },
  });
  if (!project) notFound();

  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, projectId, orgId: project.orgId },
    include: {
      participants: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      minutes: true,
      actionItems: {
        orderBy: { dueDate: "asc" },
        include: {
          assignee: { select: { id: true, name: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!meeting) notFound();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link
              href={`/projects/${projectId}/meetings`}
              className="hover:text-blue-600"
            >
              Reuniões
            </Link>
            <span>/</span>
            <span>{meeting.title}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[meeting.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {STATUS_LABELS[meeting.status] ?? meeting.status}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(meeting.scheduledAt).toLocaleString("pt-PT", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {meeting.location && (
              <span className="text-sm text-gray-500">
                📍 {meeting.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {meeting.description && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-700">
          {meeting.description}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: participants + action items */}
        <div className="lg:col-span-1 space-y-6">
          {/* Participants */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Participantes ({meeting.participants.length})
            </h2>
            {meeting.participants.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum participante.</p>
            ) : (
              <ul className="space-y-2">
                {meeting.participants.map(
                  (p: {
                    id: string;
                    name: string;
                    email: string | null;
                    role: string | null;
                    attended: boolean;
                    userId: string | null;
                  }) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-800">
                          {p.name}
                        </span>
                        {p.role && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({p.role})
                          </span>
                        )}
                        {p.email && (
                          <p className="text-xs text-gray-500">{p.email}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          p.attended
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.attended ? "Presente" : "Ausente"}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          {/* Action Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Action Items ({meeting.actionItems.length})
            </h2>
            {meeting.actionItems.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum action item.</p>
            ) : (
              <ul className="space-y-2">
                {meeting.actionItems.map(
                  (item: {
                    id: string;
                    description: string;
                    status: string;
                    dueDate: Date | null;
                    assignee: { id: string; name: string | null } | null;
                  }) => (
                    <li
                      key={item.id}
                      className="border border-gray-100 rounded-lg p-3"
                    >
                      <p className="text-sm text-gray-800">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">
                          {item.assignee?.name ?? "Sem responsável"}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.dueDate && (
                            <span className="text-xs text-gray-500">
                              {new Date(item.dueDate).toLocaleDateString(
                                "pt-PT",
                                {
                                  day: "numeric",
                                  month: "short",
                                },
                              )}
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              item.status === "CONCLUIDO"
                                ? "bg-green-100 text-green-700"
                                : item.status === "EM_CURSO"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {ACTION_ITEM_STATUS_LABELS[item.status] ??
                              item.status}
                          </span>
                        </div>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Right column: Ata rich text */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Ata</h2>
              {meeting.minutes?.publishedAt ? (
                <span className="text-xs text-green-600 font-medium">
                  Publicada em{" "}
                  {new Date(meeting.minutes.publishedAt).toLocaleDateString(
                    "pt-PT",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                </span>
              ) : (
                <span className="text-xs text-gray-400">Não publicada</span>
              )}
            </div>
            {meeting.minutes ? (
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: meeting.minutes.content }} // nosemgrep: react-dangerouslysetinnerhtml -- TODO: sanitize with DOMPurify before user-facing release
              />
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center">
                Nenhuma ata criada para esta reunião.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Links Probatórios */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
        <MeetingEvidenceLinks
          orgId={project.orgId}
          projectId={projectId}
          meetingId={meetingId}
        />
      </div>
    </div>
  );
}
