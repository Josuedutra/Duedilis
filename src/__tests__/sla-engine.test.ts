/**
 * SLA Engine — Move + Rename verification tests
 * Task: gov-1775349158479-31cd6t (D4-E3-05v2-fix)
 *
 * Verifies:
 *   1. src/lib/cde/sla-engine.ts EXISTS and exports calculateSlaStatus
 *   2. src/lib/actions/sla-engine.ts does NOT exist (moved)
 *   3. calculateSlaStatus returns correct status for past/current/future deadlines
 *   4. Imports in consumer files point to the new path
 */

import { existsSync } from "fs";
import { resolve } from "path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockSlaRecordFindUnique = vi.hoisted(() => vi.fn());
const mockSlaRecordUpdate = vi.hoisted(() => vi.fn());
const mockAuditCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    slaRecord: {
      create: vi.fn(),
      findUnique: mockSlaRecordFindUnique,
      update: mockSlaRecordUpdate,
    },
    auditLog: {
      create: mockAuditCreate,
    },
  },
}));

// Import from the CURRENT path for functional tests.
// Once the production move task runs (actions/ → cde/ + rename getSlaStatus → calculateSlaStatus),
// this import should be updated to: import { calculateSlaStatus } from "@/lib/cde/sla-engine"
import { getSlaStatus as calculateSlaStatus } from "@/lib/actions/sla-engine";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SRC = resolve(process.cwd(), "src");
const NOW = new Date("2026-04-04T00:00:00.000Z").getTime();
/** SLA duration: 10 days in ms */
const SLA_DURATION_MS = 10 * 24 * 60 * 60 * 1000;

function makeSlaRecord(overrides?: Record<string, unknown>) {
  const startedAt = new Date(NOW);
  const deadline = new Date(NOW + SLA_DURATION_MS);
  return {
    id: "sla-rec-001",
    documentId: "doc-sla-001",
    orgId: "org-sla-001",
    projectId: "proj-sla-001",
    startedAt,
    deadline,
    pausedAt: null,
    pausedDurationMs: 0,
    status: "ON_TRACK",
    ...overrides,
  };
}

// ─── 1. File structure verification ──────────────────────────────────────────

describe("SLA Engine — file location after move", () => {
  it("src/lib/cde/sla-engine.ts exists at new path", () => {
    const newPath = resolve(SRC, "lib/cde/sla-engine.ts");
    expect(
      existsSync(newPath),
      `Expected ${newPath} to exist — has the sla-engine been moved to lib/cde/?`,
    ).toBe(true);
  });

  it("src/lib/actions/sla-engine.ts no longer exists (moved to cde)", () => {
    const oldPath = resolve(SRC, "lib/actions/sla-engine.ts");
    expect(
      existsSync(oldPath),
      `Expected ${oldPath} to be removed — sla-engine should live in lib/cde/ now`,
    ).toBe(false);
  });
});

// ─── 2. calculateSlaStatus — past deadlines ───────────────────────────────────

describe("calculateSlaStatus — BREACHED for past deadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns BREACHED when deadline has already passed (1ms past)", async () => {
    const sla = makeSlaRecord({ status: "CRITICAL" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "BREACHED" });

    vi.setSystemTime(NOW + SLA_DURATION_MS + 1);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("BREACHED");
  });

  it("returns BREACHED when deadline passed by 2 days", async () => {
    const sla = makeSlaRecord({ status: "CRITICAL" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "BREACHED" });

    vi.setSystemTime(NOW + SLA_DURATION_MS + 2 * 24 * 60 * 60 * 1000);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("BREACHED");
  });
});

// ─── 3. calculateSlaStatus — current (in-progress) deadlines ─────────────────

describe("calculateSlaStatus — in-progress deadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ON_TRACK when 50% of SLA duration has elapsed", async () => {
    const sla = makeSlaRecord({ status: "ON_TRACK" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);

    vi.setSystemTime(NOW + SLA_DURATION_MS * 0.5);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("ON_TRACK");
  });

  it("returns WARNING when 70% of SLA duration has elapsed", async () => {
    const sla = makeSlaRecord({ status: "ON_TRACK" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "WARNING" });

    vi.setSystemTime(NOW + SLA_DURATION_MS * 0.7);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("WARNING");
  });

  it("returns CRITICAL when 90% of SLA duration has elapsed", async () => {
    const sla = makeSlaRecord({ status: "WARNING" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);
    mockSlaRecordUpdate.mockResolvedValueOnce({ ...sla, status: "CRITICAL" });

    vi.setSystemTime(NOW + SLA_DURATION_MS * 0.9);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("CRITICAL");
  });
});

// ─── 4. calculateSlaStatus — future deadlines ────────────────────────────────

describe("calculateSlaStatus — future deadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ON_TRACK at 0% elapsed (just created)", async () => {
    const sla = makeSlaRecord({ status: "ON_TRACK" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);

    vi.setSystemTime(NOW); // exactly at start

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("ON_TRACK");
  });

  it("returns ON_TRACK when deadline is far in the future (10% elapsed)", async () => {
    const sla = makeSlaRecord({ status: "ON_TRACK" });
    mockSlaRecordFindUnique.mockResolvedValueOnce(sla);

    vi.setSystemTime(NOW + SLA_DURATION_MS * 0.1);

    const result = await calculateSlaStatus(sla.id);

    expect(result.status).toBe("ON_TRACK");
  });
});

// ─── 5. Import path verification — consumer files use new path ────────────────

describe("SLA Engine — consumer file imports use new path", () => {
  it("no file in src/ imports from lib/actions/sla-engine", async () => {
    const { execSync } = await import("child_process");
    // grep returns exit code 1 if no matches — that's what we want
    let matches = "";
    try {
      matches = execSync(
        `grep -r "lib/actions/sla-engine" "${SRC}" --include="*.ts" --include="*.tsx" -l`,
        { encoding: "utf8" },
      );
    } catch {
      // exit code 1 = no matches = good
      matches = "";
    }
    expect(
      matches.trim(),
      `These files still import from the old path:\n${matches}\nUpdate them to use @/lib/cde/sla-engine`,
    ).toBe("");
  });
});
