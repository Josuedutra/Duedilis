import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgMembership = await prisma.orgMembership.findFirst({
    where: {
      userId: session.user.id,
      role: { in: ["ADMIN_ORG", "GESTOR_PROJETO"] },
    },
    select: { role: true },
  });

  const canCreate = !!orgMembership;

  const orgMemberOf = await prisma.orgMembership.findFirst({
    where: { userId: session.user.id },
    select: { orgId: true },
  });

  const projects = orgMemberOf
    ? await prisma.project.findMany({
        where: { orgId: orgMemberOf.orgId },
        include: {
          org: { select: { name: true } },
          _count: { select: { memberships: true, issues: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projetos</h1>
        {canCreate && (
          <Link
            href="/projects/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
            Novo Projeto
          </Link>
        )}
      </div>
      <ProjectsClient projects={projects} />
    </main>
  );
}
