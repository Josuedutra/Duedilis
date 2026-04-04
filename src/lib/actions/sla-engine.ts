"use server";

/**
 * SLA Engine — D4-05v2
 * Task: gov-1775322191896-u13dfj
 *
 * createSla, getSlaStatus (pause-aware), pauseSla, resumeSla, escalateSla
 */

import { prisma } from "@/lib/prisma";

export type SlaStatus = "ON_TRACK" | "WARNING" | "CRITICAL" | "BREACHED";

interface SlaRecord {
  id: string;
  documentId: string | null;
  orgId: string;
  projectId: string | null;
  startedAt: Date;
  deadline: Date;
  pausedAt: Date | null;
  pausedDurationMs: number;
  status: string;
}

/** Compute status from elapsed time, accounting for paused duration. */
function computeStatus(sla: {
  startedAt: Date;
  deadline: Date;
  pausedAt: Date | null;
  pausedDurationMs: number;
}): SlaStatus {
  const totalDuration = sla.deadline.getTime() - sla.startedAt.getTime();

  // If paused, freeze time at the moment of pause
  const effectiveNow = sla.pausedAt ? sla.pausedAt.getTime() : Date.now();
  const rawElapsed = effectiveNow - sla.startedAt.getTime();
  const elapsed = rawElapsed - (sla.pausedDurationMs ?? 0);
  const pct = elapsed / totalDuration;

  if (pct >= 1) return "BREACHED";
  if (pct >= 0.9) return "CRITICAL";
  if (pct >= 0.7) return "WARNING";
  return "ON_TRACK";
}

/** Create a new SLA record for an entity. */
export async function createSla(input: {
  documentId: string;
  orgId: string;
  projectId: string;
  deadline: Date;
}): Promise<SlaRecord> {
  const record = await prisma.slaRecord.create({
    data: {
      documentId: input.documentId,
      orgId: input.orgId,
      projectId: input.projectId,
      deadline: input.deadline,
      status: "ON_TRACK",
    },
  });
  return record as SlaRecord;
}

/** Evaluate current SLA status, persist changes, trigger escalation if BREACHED. */
export async function getSlaStatus(slaId: string): Promise<SlaRecord> {
  const sla = await prisma.slaRecord.findUnique({ where: { id: slaId } });
  if (!sla) throw new Error(`SlaRecord not found: ${slaId}`);

  const newStatus = computeStatus(sla as SlaRecord);

  if (newStatus === sla.status) {
    return sla as SlaRecord;
  }

  const updated = await prisma.slaRecord.update({
    where: { id: slaId },
    data: { status: newStatus },
  });

  // Trigger escalation audit when transitioning to BREACHED
  if (newStatus === "BREACHED") {
    await escalateSla(sla as SlaRecord);
  }

  return updated as SlaRecord;
}

/** Freeze SLA time counting at current moment. */
export async function pauseSla(slaId: string): Promise<SlaRecord> {
  const sla = await prisma.slaRecord.findUnique({ where: { id: slaId } });
  if (!sla) throw new Error(`SlaRecord not found: ${slaId}`);

  const updated = await prisma.slaRecord.update({
    where: { id: slaId },
    data: { pausedAt: new Date() },
  });

  return updated as SlaRecord;
}

/** Resume SLA time counting, accumulating paused duration. */
export async function resumeSla(slaId: string): Promise<SlaRecord> {
  const sla = await prisma.slaRecord.findUnique({ where: { id: slaId } });
  if (!sla) throw new Error(`SlaRecord not found: ${slaId}`);
  if (!sla.pausedAt) return sla as SlaRecord;

  const additionalPause = Date.now() - sla.pausedAt.getTime();
  const newPausedDuration = (sla.pausedDurationMs ?? 0) + additionalPause;

  const updated = await prisma.slaRecord.update({
    where: { id: slaId },
    data: {
      pausedAt: null,
      pausedDurationMs: newPausedDuration,
    },
  });

  return updated as SlaRecord;
}

/** Trigger escalation: creates an audit log entry for the breach. */
export async function escalateSla(sla: SlaRecord): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: sla.orgId,
      entityType: "SlaRecord",
      entityId: sla.id,
      action: "ESCALATED",
      userId: "system",
      hash: `escalation-${sla.id}-${Date.now()}`,
    },
  });
}
