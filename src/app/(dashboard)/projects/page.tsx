import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { memberships: { some: { userId: session.user.id } } },
    include: {
      org: { select: { name: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projetos</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{project.name}</p>
                <p className="text-sm text-gray-500">{project.slug}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  project.status === "ATIVO"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {project.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">{project.org.name}</p>
            <p className="mt-1 text-xs text-gray-400">
              {project._count.memberships} membros
            </p>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="text-gray-500 col-span-full text-center py-8">
            Nenhum projeto encontrado.
          </p>
        )}
      </div>
    </main>
  );
}
