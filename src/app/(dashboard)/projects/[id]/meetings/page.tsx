/**
 * Meetings list page — Sprint D3, Tasks D3-02/03
 * Task: gov-1775077672346-s5op4f
 *
 * Lista de reuniões do projecto. Desktop-only.
 */

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

interface Props {
  params: Promise<{ id: string }>;
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

export default async function MeetingsPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      org: { memberships: { some: { userId: session.user.id } } },
    },
    include: { org: { select: { id: true, name: true } } },
  });
  if (!project) notFound();

  const meetings = await db.meeting.findMany({
    where: { projectId, orgId: project.orgId },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { participants: true, actionItems: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div className="hidden md:block p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reuniões</h1>
          <p className="text-sm text-gray-500 mt-1">Projecto: {project.name}</p>
        </div>
        <Link
          href={`/projects/${projectId}/meetings/new`}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Nova Reunião
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">Nenhuma reunião agendada.</p>
          <Link
            href={`/projects/${projectId}/meetings/new`}
            className="mt-4 inline-block text-blue-600 text-sm font-medium hover:underline"
          >
            Agendar primeira reunião
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Reunião
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Data
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Local
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Estado
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Participantes
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Action Items
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meetings.map(
                (meeting: {
                  id: string;
                  title: string;
                  scheduledAt: Date;
                  location: string | null;
                  status: string;
                  _count: { participants: number; actionItems: number };
                }) => (
                  <tr
                    key={meeting.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${projectId}/meetings/${meeting.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {meeting.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(meeting.scheduledAt).toLocaleString("pt-PT", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {meeting.location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[meeting.status] ??
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_LABELS[meeting.status] ?? meeting.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-center">
                      {meeting._count.participants}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-center">
                      {meeting._count.actionItems}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
