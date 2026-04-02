/**
 * Issue detail page — Sprint D3, Tasks D3-04/05
 * Task: gov-1775077692551-w466q6
 *
 * Detalhe de issue (NC): informação + Links Probatórios
 */

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { IssueEvidenceLinks } from "./issue-evidence-links";

interface Props {
  params: Promise<{ id: string; issueId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em Análise",
  RESOLVIDA: "Resolvida",
  FECHADA: "Fechada",
};

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "bg-red-100 text-red-800",
  EM_ANALISE: "bg-yellow-100 text-yellow-800",
  RESOLVIDA: "bg-blue-100 text-blue-800",
  FECHADA: "bg-gray-100 text-gray-600",
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICA: "bg-red-100 text-red-800",
  ALTA: "bg-orange-100 text-orange-800",
  MEDIA: "bg-yellow-100 text-yellow-800",
  BAIXA: "bg-green-100 text-green-800",
};

export default async function IssueDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: projectId, issueId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      org: { memberships: { some: { userId: session.user.id } } },
    },
    include: { org: { select: { id: true, name: true } } },
  });
  if (!project) notFound();

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, projectId, orgId: project.orgId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
  if (!issue) notFound();

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-gray-700 transition-colors"
        >
          {project.org.name}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium truncate">
          {issue.title}
        </span>
      </nav>

      {/* Issue header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[issue.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                {STATUS_LABELS[issue.status] ?? issue.status}
              </span>
              {issue.priority && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[issue.priority] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {PRIORITY_LABELS[issue.priority] ?? issue.priority}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
            {issue.description && (
              <p className="text-sm text-gray-600 mt-2">{issue.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
          <div>
            <span className="font-medium text-gray-700">Criado por:</span>{" "}
            {issue.createdBy?.name ?? issue.createdBy?.email ?? "—"}
          </div>
          {issue.assignedTo && (
            <div>
              <span className="font-medium text-gray-700">Responsável:</span>{" "}
              {issue.assignedTo.name ?? issue.assignedTo.email}
            </div>
          )}
          <div>
            <span className="font-medium text-gray-700">Data:</span>{" "}
            {new Date(issue.createdAt).toLocaleDateString("pt-PT", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Links Probatórios */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <IssueEvidenceLinks
          orgId={project.orgId}
          projectId={projectId}
          issueId={issueId}
        />
      </div>
    </div>
  );
}
