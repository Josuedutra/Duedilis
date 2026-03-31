import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      members: { some: { userId: session.user.id } },
    },
    include: {
      organization: { select: { name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!project) notFound();

  return (
    <main className="p-6">
      <div className="mb-6">
        <p className="text-sm text-gray-500">{project.organization.name}</p>
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <p className="text-sm text-gray-500">Código: {project.code}</p>
      </div>
      {project.description && (
        <p className="text-gray-600 mb-6">{project.description}</p>
      )}
      <div>
        <h2 className="text-lg font-semibold mb-3">Membros</h2>
        <div className="space-y-2">
          {project.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between bg-white rounded border px-4 py-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {m.user.name ?? m.user.email}
                </p>
                <p className="text-xs text-gray-400">{m.user.email}</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
