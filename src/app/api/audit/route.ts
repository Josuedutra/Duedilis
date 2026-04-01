/**
 * Audit API — Sprint D2
 * Task: gov-1775041316173-u4jhw6
 *
 * GET /api/audit?entityType=Document&entityId=xxx  → audit trail da entidade
 * GET /api/audit?orgId=xxx&page=1&limit=50          → audit log global da org
 *
 * Apenas ADMIN_ORG e AUDITOR podem consultar.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const orgId = searchParams.get("orgId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)),
  );

  // Consulta por entidade específica
  if (entityType && entityId) {
    // Verificar que o user pertence à org que detém a entidade — buscar o primeiro entry para obter orgId
    const firstEntry = await prisma.auditLog.findFirst({
      where: { entityType, entityId },
      orderBy: { createdAt: "asc" },
    });
    if (!firstEntry) {
      return NextResponse.json({ entries: [] });
    }
    const membership = await prisma.orgMembership.findUnique({
      where: {
        userId_orgId: { userId: session.user.id, orgId: firstEntry.orgId },
      },
    });
    if (
      !membership ||
      !["ADMIN_ORG", "AUDITOR"].includes(membership.role as string)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const entries = await prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ entries });
  }

  // Consulta global da org
  if (orgId) {
    const membership = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: session.user.id, orgId } },
    });
    if (
      !membership ||
      !["ADMIN_ORG", "AUDITOR"].includes(membership.role as string)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where: { orgId } }),
    ]);
    return NextResponse.json({ entries, total, page, limit });
  }

  return NextResponse.json(
    { error: "Parâmetros obrigatórios: entityType+entityId ou orgId" },
    { status: 400 },
  );
}
