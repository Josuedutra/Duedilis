/**
 * N+1 detection helper — E3 Camada 6 Performance & Load
 * Task: gov-1775219627885-8o823o
 *
 * Intercepts Prisma query events during a test and fails if any endpoint
 * fires >MAX_QUERIES_FOR_LIST queries while listing N items.
 *
 * Usage:
 *   const tracker = createQueryTracker();
 *   tracker.start();
 *   await listMeetings({ orgId: "...", page: 1, pageSize: 20 });
 *   tracker.assertMaxQueries(5, "listMeetings");
 *
 * How it works:
 *   - vi.fn() spies are injected into prisma mock calls via the test-level
 *     mock infrastructure (each test file provides its own prisma mock).
 *   - The tracker counts mock invocations (findMany, findFirst, findUnique,
 *     count, aggregate, etc.) to detect N+1 patterns.
 */

export interface QueryTracker {
  /** Reset the counter and start counting. */
  start: () => void;
  /** Number of queries counted since last start(). */
  count: () => number;
  /** Throw if count exceeds maxQueries. */
  assertMaxQueries: (maxQueries: number, label: string) => void;
}

/**
 * Creates a query counter that wraps a set of Prisma mock functions.
 *
 * Pass the mock functions you want to track. Typically:
 *   findMany, findFirst, findUnique, count, aggregate, groupBy
 *
 * @param mocks - Array of vi.Mock functions to observe.
 */
export function createQueryTracker(
  mocks: Array<{ mock: ReturnType<typeof import("vitest").vi.fn> }>,
): QueryTracker {
  let baselineCallCount = 0;

  const totalCallCount = () =>
    mocks.reduce((sum, { mock }) => sum + mock.mock.calls.length, 0);

  return {
    start() {
      baselineCallCount = totalCallCount();
    },
    count() {
      return totalCallCount() - baselineCallCount;
    },
    assertMaxQueries(maxQueries: number, label: string) {
      const actual = this.count();
      if (actual > maxQueries) {
        throw new Error(
          `N+1 detected in "${label}": expected ≤${maxQueries} queries, got ${actual}. ` +
            `This indicates a missing JOIN/include or a loop calling Prisma per item.`,
        );
      }
    },
  };
}

/**
 * Lightweight inline query counter that uses a simple array of call counts.
 * Use when the test already has individual mock refs.
 *
 * @example
 *   const counter = makeCounter();
 *   mockProjectFindMany.mockImplementation((...args) => { counter.inc(); return []; });
 *   await listProjects(...);
 *   assertMaxQueries(counter.get(), 3, "listProjects");
 */
export function makeCounter() {
  let n = 0;
  return {
    inc: () => {
      n++;
    },
    get: () => n,
    reset: () => {
      n = 0;
    },
  };
}

/**
 * Assert helper (standalone — no tracker object needed).
 */
export function assertMaxQueries(actual: number, max: number, label: string) {
  if (actual > max) {
    throw new Error(
      `N+1 detected in "${label}": expected ≤${max} queries, got ${actual}.`,
    );
  }
}
