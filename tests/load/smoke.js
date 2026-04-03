/**
 * k6 smoke test — E3 Camada 6 Performance & Load
 * Task: gov-1775219627885-8o823o
 *
 * Executar:
 *   k6 run tests/load/smoke.js \
 *     --env BASE_URL=https://duedilis.vercel.app \
 *     --env TEST_EMAIL=test@example.com \
 *     --env TEST_PASSWORD=testpassword
 *
 * SLOs:
 *   - p95 < 500ms
 *   - error rate < 1%
 */

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"], // p95 < 500ms
    http_req_failed: ["rate<0.01"], // <1% errors
  },
};

// eslint-disable-next-line import/no-anonymous-default-export
export default function () {
  const baseUrl = __ENV.BASE_URL || "http://localhost:3000";

  // ── Health check ──────────────────────────────────────────────────────────
  const health = http.get(`${baseUrl}/api/health`);
  check(health, {
    "health 200": (r) => r.status === 200,
    "health body has status": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === "healthy" || body.status === "degraded";
      } catch {
        return false;
      }
    },
  });

  // ── Auth flow (login via credentials) ────────────────────────────────────
  const loginPayload = JSON.stringify({
    email: __ENV.TEST_EMAIL || "test@example.com",
    password: __ENV.TEST_PASSWORD || "testpassword",
  });

  const loginParams = {
    headers: { "Content-Type": "application/json" },
  };

  const login = http.post(
    `${baseUrl}/api/auth/callback/credentials`,
    loginPayload,
    loginParams,
  );

  // NextAuth credentials callback returns 200 or 302 on success
  check(login, {
    "login reachable": (r) => r.status !== 500 && r.status !== 503,
  });

  // ── Projects list (public API, no auth token needed for smoke) ────────────
  const projects = http.get(`${baseUrl}/api/projects`);
  check(projects, {
    "projects reachable": (r) => r.status !== 500 && r.status !== 503,
    "projects response <500ms": (r) => r.timings.duration < 500,
  });

  // ── Meetings list ─────────────────────────────────────────────────────────
  const meetings = http.get(`${baseUrl}/api/meetings?orgId=smoke-org`);
  check(meetings, {
    "meetings reachable": (r) => r.status !== 500 && r.status !== 503,
    "meetings response <500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
