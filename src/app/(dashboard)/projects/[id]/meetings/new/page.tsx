/**
 * New meeting form page — Sprint D3, Tasks D3-02/03
 * Task: gov-1775077672346-s5op4f
 *
 * Formulário para criar nova reunião. Desktop-only.
 */

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewMeetingForm } from "./new-meeting-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewMeetingPage({ params }: Props) {
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

  return (
    <div className="hidden md:block p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nova Reunião</h1>
        <p className="text-sm text-gray-500 mt-1">Projecto: {project.name}</p>
      </div>
      <NewMeetingForm projectId={projectId} orgId={project.orgId} />
    </div>
  );
}
