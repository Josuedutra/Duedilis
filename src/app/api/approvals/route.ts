/**
 * GET /api/approvals
 * List approvals, optionally filtered by projectId, folderId, or status.
 *
 * Query params: projectId?, folderId?, status? (PENDING_REVIEW|APPROVED|REJECTED|CANCELLED|ALL)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const folderId = searchParams.get("folderId");
  const statusParam = searchParams.get("status") ?? "PENDING_REVIEW";

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (statusParam !== "ALL") {
    where.status = statusParam;
  }

  if (folderId) {
    where.folderId = folderId;
  }

  // Filter by projectId via document relation
  if (projectId) {
    where.document = { projectId };
  }

  // Ensure user is a member of the org (via document→org→memberships)
  where.org = {
    memberships: { some: { userId: session.user.id } },
  };

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
    take: 50,
  });

  return NextResponse.json({ approvals });
}
