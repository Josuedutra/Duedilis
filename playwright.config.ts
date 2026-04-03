import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for Duedilis.
 * @see https://playwright.dev/docs/test-configuration
 *
 * CI provides a real PostgreSQL database for the e2e job.
 * Tests must NOT skip — if DB is missing, CI fails (correct behaviour).
 */

export default defineConfig({
  testDir: "./e2e",

  /* Global setup: seed DB with E2E fixtures */
  globalSetup: "./e2e/seed.ts",

  /* Run tests in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,

  /* Single worker in CI to avoid DB contention */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter */
  reporter: [["html", { open: "never" }], ["list"]],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",

    /* 30s timeout per action */
    actionTimeout: 30_000,

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Collect trace when retrying */
    trace: "on-first-retry",

    /* Video on failure */
    video: "retain-on-failure",
  },

  /* Default test timeout: 30s */
  timeout: 30_000,

  /* Projects */
  projects: [
    {
      name: "chromium",
      /* hasTouch enables .tap() in Desktop Chrome — required by touch.spec.ts */
      use: { ...devices["Desktop Chrome"], hasTouch: true },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],

  /* Dev server — only start when not in CI (CI provides the URL via PLAYWRIGHT_BASE_URL) */
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        port: 3000,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
