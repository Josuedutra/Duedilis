import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditProjectForm } from "./form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      org: { memberships: { some: { userId: session.user.id } } },
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      slug: true,
      description: true,
      address: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!project) notFound();

  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: project.orgId } },
    select: { role: true },
  });

  if (
    !membership ||
    !["ADMIN_ORG", "GESTOR_PROJETO"].includes(membership.role)
  ) {
    redirect(`/projects/${id}`);
  }

  return (
    <EditProjectForm
      project={{
        id: project.id,
        orgId: project.orgId,
        name: project.name,
        slug: project.slug,
        description: project.description ?? "",
        address: project.address ?? "",
        startDate: project.startDate
          ? project.startDate.toISOString().split("T")[0]
          : "",
        endDate: project.endDate
          ? project.endDate.toISOString().split("T")[0]
          : "",
        status: project.status,
      }}
    />
  );
}
