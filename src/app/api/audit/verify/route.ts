/**
 * Audit verify API — Sprint D2
 * Task: gov-1775041316173-u4jhw6
 *
 * GET /api/audit/verify?entityType=Document&entityId=xxx
 * → retorna { valid: boolean, brokenAt?: number, count: number }
 *
 * Apenas ADMIN_ORG e AUDITOR podem verificar.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyAuditChain } from "@/lib/services/audit-verify";
import type { AuditEntityType } from "@/lib/services/audit-log";

const VALID_ENTITY_TYPES: AuditEntityType[] = [
  "Issue",
  "Evidence",
  "Document",
  "Approval",
  "Photo",
  "CdeFolder",
];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as AuditEntityType | null;
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entityType e entityId são obrigatórios" },
      { status: 400 },
    );
  }

  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json(
      { error: `entityType inválido: ${entityType}` },
      { status: 400 },
    );
  }

  // Verificar permissão: buscar o primeiro entry para obter orgId
  const firstEntry = await prisma.auditLog.findFirst({
    where: { entityType, entityId },
    orderBy: { createdAt: "asc" },
  });
  if (!firstEntry) {
    return NextResponse.json({ valid: true, count: 0 });
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

  const result = await verifyAuditChain(entityType, entityId);
  return NextResponse.json(result);
}
