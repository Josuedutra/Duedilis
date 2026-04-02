/**
 * AuditLog service — Sprint D2
 * Task: gov-1775041316173-u4jhw6
 *
 * Serviço reutilizável para criar entries no AuditLog com hash chain.
 * Compatível com o AuditLog de D1 (Issues/Evidence).
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { AuditLog } from "@prisma/client";

export type AuditEntityType =
  | "Issue"
  | "Evidence"
  | "Document"
  | "Approval"
  | "Photo"
  | "CdeFolder"
  | "Meeting";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "TRANSITION"
  | "APPROVE"
  | "REJECT"
  | "CANCEL"
  | "MEETING_CREATE"
  | "MEETING_CANCEL"
  | "MEETING_START_EM_CURSO"
  | "MEETING_END";

export interface CreateAuditEntryInput {
  orgId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  userId: string;
  payload?: Record<string, unknown>;
}

/**
 * Calcula o hash SHA-256 de uma entry de AuditLog.
 * Formato: SHA-256(prevHash + entityType + entityId + action + userId + JSON(payload) + createdAt)
 */
export function computeAuditHash(params: {
  prevHash: string | null;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  payload: Record<string, unknown> | null | undefined;
  createdAt: Date;
}): string {
  const raw = [
    params.prevHash ?? "",
    params.entityType,
    params.entityId,
    params.action,
    params.userId,
    JSON.stringify(params.payload ?? null),
    params.createdAt.toISOString(),
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Cria uma entry no AuditLog com hash chain.
 * - Busca o último entry para a mesma entity para obter prevHash
 * - Calcula hash da nova entry
 * - Persiste na DB
 */
export async function createAuditEntry(
  input: CreateAuditEntryInput,
): Promise<AuditLog> {
  const lastEntry = await prisma.auditLog.findFirst({
    where: { entityType: input.entityType, entityId: input.entityId },
    orderBy: { createdAt: "desc" },
  });

  const prevHash = lastEntry?.hash ?? null;
  const createdAt = new Date();

  const hash = computeAuditHash({
    prevHash,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    userId: input.userId,
    payload: input.payload,
    createdAt,
  });

  return prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      userId: input.userId,
      payload: (input.payload ?? undefined) as
        | import("@prisma/client").Prisma.InputJsonValue
        | undefined,
      prevHash,
      hash,
      createdAt,
    },
  });
}
