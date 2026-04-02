import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listEvidenceLinks } from "@/lib/actions/evidence-link-actions";

interface Props {
  params: Promise<{ entityType: string; entityId: string }>;
}

/**
 * GET /api/evidence-links/[entityType]/[entityId]/trail?orgId=
 * Audit trail completo de uma entidade:
 * - links probatórios (source + target)
 * - audit logs da entidade
 * - ordenados por createdAt
 */
export async function GET(request: NextRequest, { params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entityType, entityId } = await params;
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    // Verificar membership
    const membership = await prisma.orgMembership.findUnique({
      where: {
        userId_orgId: { userId: session.user.id, orgId },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Links bidirecionais
    const validEntityType = entityType as
      | "Issue"
      | "Document"
      | "Photo"
      | "Meeting";
    const [asSource, asTarget] = await Promise.all([
      listEvidenceLinks({
        orgId,
        sourceType: validEntityType,
        sourceId: entityId,
      }),
      listEvidenceLinks({
        orgId,
        targetType: validEntityType,
        targetId: entityId,
      }),
    ]);

    const seen = new Set<string>();
    const links = [...asSource, ...asTarget].filter((l: { id: string }) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });

    // Audit logs da entidade
    const auditLogs = await prisma.auditLog.findMany({
      where: { orgId, entityType, entityId },
      orderBy: { createdAt: "asc" },
    });

    // Timeline unificada ordenada por createdAt
    const timeline = [
      ...links.map(
        (l: {
          id: string;
          sourceType: string;
          sourceId: string;
          targetType: string;
          targetId: string;
          description: string | null;
          createdById: string;
          createdAt: Date;
          hash: string;
        }) => ({
          type: "link" as const,
          id: l.id,
          sourceType: l.sourceType,
          sourceId: l.sourceId,
          targetType: l.targetType,
          targetId: l.targetId,
          description: l.description,
          createdById: l.createdById,
          createdAt: l.createdAt,
          hash: l.hash,
        }),
      ),
      ...auditLogs.map((a) => ({
        type: "audit" as const,
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        userId: a.userId,
        createdAt: a.createdAt,
        hash: a.hash,
        payload: a.payload,
      })),
    ].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return NextResponse.json({ entityType, entityId, timeline });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("403")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
