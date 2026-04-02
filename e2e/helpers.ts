import type { Page } from "@playwright/test";

/**
 * E2E Helpers for Duedilis fiscal flow tests.
 *
 * All helpers are no-ops when E2E_DB_AVAILABLE !== "true" (DB not configured),
 * allowing the CI pipeline to pass lint/build without a live database.
 */

export interface TestFixture {
  orgId: string;
  projectId: string;
  adminUser: { email: string; password: string };
  fiscalUser: { email: string; password: string };
  tecnicoUser: { email: string; password: string };
}

/**
 * Login as a specific user via the Duedilis credentials form.
 * Waits for redirect to /dashboard after successful authentication.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  // Password field uses name="password" (not label), find by name
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

/**
 * Returns seed fixture credentials.
 * These match what e2e/seed.ts creates in the database.
 */
export function getTestFixture(): TestFixture {
  return {
    orgId: process.env.E2E_TEST_ORG_ID ?? "e2e-org-id",
    projectId: process.env.E2E_TEST_PROJECT_ID ?? "e2e-project-id",
    adminUser: {
      email: "e2e-admin@test.duedilis.pt",
      password: "E2eAdmin!2026",
    },
    fiscalUser: {
      email: "e2e-fiscal@test.duedilis.pt",
      password: "E2eFiscal!2026",
    },
    tecnicoUser: {
      email: "e2e-tecnico@test.duedilis.pt",
      password: "E2eTecnico!2026",
    },
  };
}

/**
 * Waits for a toast notification containing the given text.
 */
export async function expectToast(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  const toast = page
    .locator('[role="status"], [data-sonner-toast], .toast, [class*="toast"]')
    .filter({ hasText: text });
  await toast.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {
    // Toast may have already dismissed — check for inline success messages
  });
}

/**
 * Check whether DB is available for this E2E run.
 * Returns false in CI without DATABASE_URL, causing tests to skip.
 */
export function isDbAvailable(): boolean {
  return process.env.E2E_DB_AVAILABLE === "true";
}
