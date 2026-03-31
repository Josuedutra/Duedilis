import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ProjectActions } from "./project-actions";
import { AddProjectMemberForm } from "./add-member-form";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  SUSPENSO: "Suspenso",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  ATIVO: "bg-green-100 text-green-800",
  SUSPENSO: "bg-yellow-100 text-yellow-800",
  CONCLUIDO: "bg-blue-100 text-blue-800",
  CANCELADO: "bg-gray-100 text-gray-600",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN_ORG: "Admin",
  GESTOR_PROJETO: "Gestor",
  FISCAL: "Fiscal",
  TECNICO: "Técnico",
  AUDITOR: "Auditor",
  OBSERVADOR: "Observador",
};

export default async function ProjectPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      org: {
        memberships: { some: { userId: session.user.id } },
      },
    },
    include: {
      org: { select: { name: true, id: true } },
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          memberships: true,
          issues: true,
        },
      },
    },
  });

  if (!project) notFound();

  const myOrgMembership = await prisma.orgMembership.findUnique({
    where: {
      userId_orgId: { userId: session.user.id, orgId: project.orgId },
    },
    select: { role: true },
  });

  const myProjectMembership = project.memberships.find(
    (m) => m.user.id === session.user.id,
  );

  const canManage =
    myOrgMembership?.role === "ADMIN_ORG" ||
    myOrgMembership?.role === "GESTOR_PROJETO" ||
    myProjectMembership?.role === "GESTOR_PROJETO";

  const orgMembers = canManage
    ? await prisma.orgMembership.findMany({
        where: {
          orgId: project.orgId,
          userId: { notIn: project.memberships.map((m) => m.user.id) },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      })
    : [];

  return (
    <main className="p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/projects"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Projetos
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-sm text-gray-500">{project.org.name}</p>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-400 font-mono mt-0.5">
            {project.slug}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-600"}`}
          >
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
          {canManage && (
            <ProjectActions projectId={project.id} status={project.status} />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Membros" value={project._count.memberships} />
        <StatCard label="Issues" value={project._count.issues} />
        <StatCard
          label="Início"
          value={project.startDate ? formatDate(project.startDate) : "—"}
        />
        <StatCard
          label="Fim"
          value={project.endDate ? formatDate(project.endDate) : "—"}
        />
      </div>

      {/* Description + Address */}
      {(project.description || project.address) && (
        <div className="bg-white rounded-xl border p-5 mb-6 space-y-3">
          {project.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Descrição
              </p>
              <p className="text-sm text-gray-700">{project.description}</p>
            </div>
          )}
          {project.address && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Localização
              </p>
              <p className="text-sm text-gray-700">{project.address}</p>
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Membros do Projeto
          </h2>
          <span className="text-sm text-gray-500">
            {project._count.memberships}
          </span>
        </div>

        <div className="space-y-2">
          {project.memberships.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center uppercase select-none">
                  {(m.user.name ?? m.user.email ?? "?")[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {m.user.name ?? m.user.email}
                  </p>
                  {m.user.name && (
                    <p className="text-xs text-gray-500">{m.user.email}</p>
                  )}
                </div>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </div>
          ))}

          {project.memberships.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Sem membros atribuídos.
            </p>
          )}
        </div>

        {canManage && orgMembers.length > 0 && (
          <AddProjectMemberForm
            projectId={project.id}
            orgMembers={orgMembers.map((m) => ({
              userId: m.userId,
              name: m.user.name,
              email: m.user.email,
            }))}
          />
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
