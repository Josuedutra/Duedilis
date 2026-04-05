/**
 * SLA Engine — TDD red phase
 * Task: gov-1775321979163-jif6dm (D4-E3-05v2)
 *
 * Tests SLA engine thresholds, pause/resume, and escalation.
 *
 * Scenarios (6 mandatory):
 *  1. SLA criado com deadline → status ON_TRACK quando tempo < 70%
 *  2. Status WARNING quando tempo consumido ≥ 70%
 *  3. Status CRITICAL quando tempo consumido ≥ 90%
 *  4. Status BREACHED quando tempo consumido ≥ 100%
 *  5. pauseSla() congela o tempo + resumeSla() retoma correctamente
 *  6. Escalation triggered automaticamente em BREACHED
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockSlaRecordCreate = vi.hoisted(() => vi.fn());
const mockSlaRecordFindUnique = vi.hoisted(() => vi.fn());
const mockSlaRecordUpdate = vi.hoisted(() => vi.fn());
const mockAuditCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    slaRecord: {
      create: mockSlaRecordCreate,
      findUnique: mockSlaRecordFindUnique,
      update: mockSlaRecordUpdate,
    },
    auditLog: {
      create: mockAuditCreate,
    },
  },
}));

// Import functions under test (do not exist yet — TDD red phase)
import {
  createSla,
  calculateSlaStatus,
  pauseSla,
  resumeSla,
} from "@/lib/cde/sla-engine";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DOCUMENT_ID = "doc-sla-001";
const ORG_ID = "org-sla-001";
const PROJECT_ID = "proj-sla-001";

/** SLA duration: 10 days in ms */
const SLA_DURATION_MS = 10 * 24 * 60 * 60 * 1000;

const NOW = new Date("2026-04-04T00:00:00.000Z").getTime();

function makeSlaRecord(overrides?: Record<string, unknown>) {
  const startedAt = new Date(NOW);
  const deadline = new Date(NOW + SLA_DURATION_MS);
  return {
    id: "sla-rec-001",
    documentId: DOCUMENT_ID,
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    startedAt,
    deadline,
    pausedAt: null,
    pausedDurationMs: 0,
    status: "ON_TRACK",
    ...overrides,
  };
}

// ─── 1. ON_TRACK — tempo < 70% ────────────────────────────────────────────────

describe("SLA Engine — ON_TRACK when elapsed < 70% of duration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ON_TRACK when 50% of SLA duration has elapsed", async () => {
    const sla = makeSlaRecord({ status: "ON_TRACK" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);

    // Simulate time at 50% elapsed
    const elapsed50pct = NOW + SLA_DURATION_MS * 0.5;
    vi.setSystemTime(elapsed50pct);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("ON_TRACK");
  });

  it("creates SLA record with ON_TRACK status and correct deadline", async () => {
    const deadline = new Date(NOW + SLA_DURATION_MS);
    const created = makeSlaRecord();
    mockSlaRecordCreate.mockResolvedValueOnce(created);

    vi.setSystemTime(NOW);

    const result = await createSla({
      documentId: DOCUMENT_ID,
      orgId: ORG_ID,
      projectId: PROJECT_ID,
      deadline,
    });

    expect(result.status).toBe("ON_TRACK");
    expect(mockSlaRecordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: DOCUMENT_ID,
          deadline,
          status: "ON_TRACK",
        }),
      }),
    );
  });
});

// ─── 2. WARNING — tempo ≥ 70% ────────────────────────────────────────────────

describe("SLA Engine — WARNING when elapsed ≥ 70% of duration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns WARNING when exactly 70% of SLA duration has elapsed", async () => {
    const sla = makeSlaRecord({ status: "ON_TRACK" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "WARNING" });

    // Simulate time at exactly 70% elapsed
    const elapsed70pct = NOW + SLA_DURATION_MS * 0.7;
    vi.setSystemTime(elapsed70pct);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("WARNING");
  });

  it("returns WARNING when 80% of SLA duration has elapsed", async () => {
    const sla = makeSlaRecord({ status: "WARNING" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "WARNING" });

    const elapsed80pct = NOW + SLA_DURATION_MS * 0.8;
    vi.setSystemTime(elapsed80pct);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("WARNING");
  });
});

// ─── 3. CRITICAL — tempo ≥ 90% ───────────────────────────────────────────────

describe("SLA Engine — CRITICAL when elapsed ≥ 90% of duration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns CRITICAL when exactly 90% of SLA duration has elapsed", async () => {
    const sla = makeSlaRecord({ status: "WARNING" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "CRITICAL" });

    const elapsed90pct = NOW + SLA_DURATION_MS * 0.9;
    vi.setSystemTime(elapsed90pct);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("CRITICAL");
  });

  it("returns CRITICAL when 95% of SLA duration has elapsed", async () => {
    const sla = makeSlaRecord({ status: "CRITICAL" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "CRITICAL" });

    const elapsed95pct = NOW + SLA_DURATION_MS * 0.95;
    vi.setSystemTime(elapsed95pct);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("CRITICAL");
  });
});

// ─── 4. BREACHED — tempo ≥ 100% ──────────────────────────────────────────────

describe("SLA Engine — BREACHED when elapsed ≥ 100% of duration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns BREACHED when deadline has passed", async () => {
    const sla = makeSlaRecord({ status: "CRITICAL" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "BREACHED" });

    // 1ms past deadline
    const pastDeadline = NOW + SLA_DURATION_MS + 1;
    vi.setSystemTime(pastDeadline);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("BREACHED");
  });

  it("updates slaRecord status to BREACHED when deadline exceeded", async () => {
    const sla = makeSlaRecord({ status: "CRITICAL" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "BREACHED" });

    vi.setSystemTime(NOW + SLA_DURATION_MS + 1000);

    await calculateSlaStatus(sla.id);

    expect(mockSlaRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sla.id },
        data: expect.objectContaining({ status: "BREACHED" }),
      }),
    );
  });
});

// ─── 5. pauseSla() + resumeSla() ─────────────────────────────────────────────

describe("SLA Engine — pauseSla() congela o tempo + resumeSla() retoma", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pauseSla() sets pausedAt to current time", async () => {
    const pauseTime = NOW + SLA_DURATION_MS * 0.3;
    vi.setSystemTime(pauseTime);

    const sla = makeSlaRecord({ status: "ON_TRACK" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({
      ...sla,
      pausedAt: new Date(pauseTime),
    });

    const result = await pauseSla(sla.id);

    expect(result.pausedAt).toEqual(new Date(pauseTime));
    expect(mockSlaRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sla.id },
        data: expect.objectContaining({
          pausedAt: new Date(pauseTime),
        }),
      }),
    );
  });

  it("resumeSla() clears pausedAt and accumulates pausedDurationMs", async () => {
    const pauseTime = NOW + SLA_DURATION_MS * 0.3;
    const resumeTime = pauseTime + 60 * 60 * 1000; // paused for 1 hour

    const pausedSla = makeSlaRecord({
      status: "ON_TRACK",
      pausedAt: new Date(pauseTime),
      pausedDurationMs: 0,
    });

    mockSlaRecordFindUnique.mockResolvedValueOnce(pausedSla);
    mockSlaRecordUpdate.mockResolvedValueOnce({
      ...pausedSla,
      pausedAt: null,
      pausedDurationMs: 60 * 60 * 1000,
    });

    vi.setSystemTime(resumeTime);

    const result = await resumeSla(pausedSla.id);

    expect(result.pausedAt).toBeNull();
    expect(result.pausedDurationMs).toBe(60 * 60 * 1000);
    expect(mockSlaRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pausedSla.id },
        data: expect.objectContaining({
          pausedAt: null,
          pausedDurationMs: 60 * 60 * 1000,
        }),
      }),
    );
  });

  it("paused SLA does not advance — status stays ON_TRACK after pause duration", async () => {
    // SLA paused at 30%, 2 days pass while paused → should still be ON_TRACK
    const pauseTime = NOW + SLA_DURATION_MS * 0.3;
    const checkTime = pauseTime + SLA_DURATION_MS * 0.5; // 50% more time passes while paused

    const pausedSla = makeSlaRecord({
      status: "ON_TRACK",
      pausedAt: new Date(pauseTime),
      pausedDurationMs: 0,
    });

    mockSlaRecordFindUnique.mockResolvedValueOnce(pausedSla);

    vi.setSystemTime(checkTime);

    const result = await calculateSlaStatus(pausedSla.id);

    // While paused, time is frozen at 30% elapsed → still ON_TRACK
    expect(result.status).toBe("ON_TRACK");
  });
});

// ─── 6. Escalation triggered automaticamente em BREACHED ─────────────────────

describe("SLA Engine — escalation triggered automatically on BREACHED", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("triggers escalation audit entry when status transitions to BREACHED", async () => {
    const sla = makeSlaRecord({ status: "CRITICAL" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "BREACHED" });
    mockAuditCreate.mockResolvedValueOnce({ id: "audit-escalation-001" });

    vi.setSystemTime(NOW + SLA_DURATION_MS + 1000);

    await calculateSlaStatus(sla.id);

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "SlaRecord",
          entityId: sla.id,
          action: "ESCALATED",
        }),
      }),
    );
  });

  it("does not trigger escalation when status is CRITICAL (not yet breached)", async () => {
    const sla = makeSlaRecord({ status: "WARNING" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "CRITICAL" });

    vi.setSystemTime(NOW + SLA_DURATION_MS * 0.92);

    await calculateSlaStatus(sla.id);

    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});
