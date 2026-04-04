"use server";

/**
 * SLA Engine — stub for TDD red phase
 * Task: gov-1775321979163-jif6dm (D4-E3-05v2)
 *
 * Full implementation tracked in separate task (D4-04: SLA engine implementation).
 * These stubs exist so tests can run and fail at assertion level.
 */

export async function createSla(_input: {
  documentId: string;
  orgId: string;
  projectId: string;
  deadline: Date;
}): Promise<{
  id: string;
  documentId: string;
  orgId: string;
  projectId: string;
  startedAt: Date;
  deadline: Date;
  pausedAt: Date | null;
  pausedDurationMs: number;
  status: string;
}> {
  throw new Error("Not implemented");
}

export async function getSlaStatus(_slaId: string): Promise<{
  id: string;
  status: string;
  pausedAt: Date | null;
  pausedDurationMs: number;
}> {
  throw new Error("Not implemented");
}

export async function pauseSla(_slaId: string): Promise<{
  id: string;
  status: string;
  pausedAt: Date | null;
  pausedDurationMs: number;
}> {
  throw new Error("Not implemented");
}

export async function resumeSla(_slaId: string): Promise<{
  id: string;
  status: string;
  pausedAt: Date | null;
  pausedDurationMs: number;
}> {
  throw new Error("Not implemented");
}
