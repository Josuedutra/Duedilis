import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewProjectForm } from "./form";

export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMembership.findFirst({
    where: {
      userId: session.user.id,
      role: { in: ["ADMIN_ORG", "GESTOR_PROJETO"] },
    },
    select: { orgId: true },
  });

  if (!membership) {
    return (
      <main className="p-6">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          Não tem permissão para criar projetos. É necessário ser ADMIN_ORG ou
          GESTOR_PROJETO.
        </div>
      </main>
    );
  }

  return <NewProjectForm orgId={membership.orgId} />;
}
