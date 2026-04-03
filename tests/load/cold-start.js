/**
 * Cold start benchmark — E3 Camada 6 Performance & Load
 * Task: gov-1775219627885-8o823o
 *
 * Objectivo: medir a latência de cold start de funções serverless Vercel.
 *
 * Vercel Serverless: após 10min sem requests, a função é desalocada.
 * O primeiro request após o período de inactividade incorre no cold start.
 *
 * Target: cold start < 3s (3000ms)
 *
 * ATENÇÃO: Este test NÃO deve ser executado no CI per-PR (demasiado lento).
 * Executar manualmente antes de releases:
 *
 *   k6 run tests/load/cold-start.js \
 *     --env BASE_URL=https://duedilis-<branch>.vercel.app
 *
 * Interpretação dos resultados:
 *   - http_req_duration p(50) ≈ warm request time
 *   - O primeiro request (coldStartDuration) é o cold start real
 *   - Se cold start > 3000ms: optimizar bundle size ou usar Vercel Fluid Compute
 */

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  // Single VU: one request to force cold start measurement
  vus: 1,
  iterations: 1,
  thresholds: {
    // Cold start target: < 3s
    http_req_duration: ["p(100)<3000"],
    http_req_failed: ["rate<0.01"],
  },
};

export function setup() {
  const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
  console.log(`Cold start benchmark: ${baseUrl}`);
  console.log("NOTE: For accurate cold start measurement, ensure the function");
  console.log("has been idle for at least 10 minutes before running.");
  return { baseUrl };
}

// eslint-disable-next-line import/no-anonymous-default-export
export default function (data) {
  const { baseUrl } = data;

  // ── Cold start request ─────────────────────────────────────────────────────
  // This is the request that measures cold start latency.
  // For accurate measurement, this must be the FIRST request after idle period.

  const coldStartReq = http.get(`${baseUrl}/api/health`, {
    tags: { name: "cold_start" },
    timeout: "10s", // Generous timeout for cold start
  });

  check(coldStartReq, {
    "cold start: health responds": (r) => r.status === 200 || r.status === 503,
    "cold start: latency < 3000ms": (r) => r.timings.duration < 3000,
    "cold start: latency < 5000ms (degraded target)": (r) =>
      r.timings.duration < 5000,
  });

  console.log(
    `Cold start duration: ${coldStartReq.timings.duration.toFixed(0)}ms`,
  );
  console.log(`  TTFB: ${coldStartReq.timings.waiting.toFixed(0)}ms`);
  console.log(`  Connect: ${coldStartReq.timings.connecting.toFixed(0)}ms`);
  console.log(`  Status: ${coldStartReq.status}`);

  if (coldStartReq.timings.duration > 3000) {
    console.warn(
      `⚠️  Cold start EXCEEDED target: ${coldStartReq.timings.duration.toFixed(0)}ms > 3000ms`,
    );
    console.warn("   Consider: bundle splitting, Vercel Fluid Compute, or");
    console.warn("   warming strategy (scheduled keep-alive requests).");
  } else {
    console.log(
      `✅ Cold start within target: ${coldStartReq.timings.duration.toFixed(0)}ms < 3000ms`,
    );
  }

  sleep(1);

  // ── Warm request (baseline comparison) ────────────────────────────────────
  // After cold start, measure warm request time for comparison.
  const warmReq = http.get(`${baseUrl}/api/health`, {
    tags: { name: "warm_request" },
  });

  check(warmReq, {
    "warm request: health responds": (r) =>
      r.status === 200 || r.status === 503,
    "warm request: latency < 500ms": (r) => r.timings.duration < 500,
  });

  console.log(
    `Warm request duration: ${warmReq.timings.duration.toFixed(0)}ms`,
  );
  console.log(
    `Cold start overhead: ${(coldStartReq.timings.duration - warmReq.timings.duration).toFixed(0)}ms`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function teardown(_data) {
  console.log("\n=== Cold Start Benchmark Summary ===");
  console.log("Target: cold start < 3000ms");
  console.log("Run this test manually before each release.");
  console.log("Document baseline in: docs/performance-baseline.md");
}
