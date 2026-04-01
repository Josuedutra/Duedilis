/**
 * AuditLog verification service — Sprint D2
 * Task: gov-1775041316173-u4jhw6
 *
 * Verifica a integridade da hash chain para uma entidade específica.
 */

import { prisma } from "@/lib/prisma";
import { computeAuditHash } from "./audit-log";
import type { AuditEntityType } from "./audit-log";

export interface VerifyResult {
  valid: boolean;
  /** Índice (0-based) da entry onde a chain foi corrompida, se aplicável */
  brokenAt?: number;
  /** Total de entries verificadas */
  count: number;
}

/**
 * Verifica que todos os hashes na chain de uma entidade estão correctos.
 * Percorre as entries por ordem cronológica e recomputa cada hash.
 */
export async function verifyAuditChain(
  entityType: AuditEntityType,
  entityId: string,
): Promise<VerifyResult> {
  const entries = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "asc" },
  });

  if (entries.length === 0) {
    return { valid: true, count: 0 };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? null : entries[i - 1].hash;

    const expectedHash = computeAuditHash({
      prevHash: expectedPrevHash,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
      payload: entry.payload as Record<string, unknown> | null | undefined,
      createdAt: entry.createdAt,
    });

    if (entry.hash !== expectedHash) {
      return { valid: false, brokenAt: i, count: entries.length };
    }

    // Verificar que prevHash aponta para o anterior
    if (entry.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAt: i, count: entries.length };
    }
  }

  return { valid: true, count: entries.length };
}
