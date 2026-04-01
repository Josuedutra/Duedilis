/**
 * Approvals queue page — Sprint D2-07/08
 * Task: gov-1775041268972-jcae07
 *
 * Tabela de aprovações pendentes por projecto.
 * Filtros: Pendentes | Aprovadas | Rejeitadas | Todas
 */

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalsQueueClient } from "./approvals-queue-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function ApprovalsPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id: projectId } = await params;
  const { status: statusFilter = "PENDING_REVIEW" } = await searchParams;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      org: { memberships: { some: { userId: session.user.id } } },
    },
    include: { org: { select: { id: true, name: true } } },
  });
  if (!project) notFound();

  // Build status filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    orgId: project.orgId,
    document: { projectId },
  };

  if (statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  const approvals = await db.approval.findMany({
    where,
    include: {
      document: {
        select: { id: true, originalName: true, isoName: true, status: true },
      },
      submitter: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <ApprovalsQueueClient
      project={{ id: project.id, name: project.name, orgId: project.orgId }}
      initialApprovals={approvals.map(
        (a: {
          id: string;
          status: string;
          createdAt: Date;
          document: {
            id: string;
            originalName: string;
            isoName: string | null;
            status: string;
          };
          submitter: { id: string; name: string | null; email: string | null };
          reviewer: {
            id: string;
            name: string | null;
            email: string | null;
          } | null;
        }) => ({
          id: a.id,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
          document: {
            id: a.document.id,
            originalName: a.document.originalName,
            isoName: a.document.isoName,
            status: a.document.status,
          },
          submitter: {
            id: a.submitter.id,
            name: a.submitter.name,
            email: a.submitter.email,
          },
          reviewer: a.reviewer
            ? {
                id: a.reviewer.id,
                name: a.reviewer.name,
                email: a.reviewer.email,
              }
            : null,
        }),
      )}
      currentUserId={session.user.id}
      statusFilter={statusFilter}
    />
  );
}
