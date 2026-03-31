import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const projectCount = await prisma.project.count({
    where: { members: { some: { userId: session.user.id } } },
  });

  const orgCount = await prisma.membership.count({
    where: { userId: session.user.id, status: "ACTIVE" },
  });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Projetos</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">
            {projectCount}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm font-medium text-gray-500">Organizações</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">
            {orgCount}
          </p>
        </div>
      </div>
    </main>
  );
}
