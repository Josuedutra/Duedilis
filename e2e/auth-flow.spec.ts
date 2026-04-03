import { test, expect, type Page } from "@playwright/test";

/**
 * Duedilis E2E — Auth flows
 *
 * Tests login, logout, redirect, and sidebar navigation.
 * Requires a real PostgreSQL database. CI provides one via the e2e job.
 *
 * Demo credentials created by seed_demo.js:
 *   admin@demo.duedilis.com / demo123
 */

const ADMIN_EMAIL = "admin@demo.duedilis.com";
const ADMIN_PASSWORD = "demo123";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Auth flows", () => {
  test("login with valid credentials → dashboard loads", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible(
      { timeout: 15_000 },
    );
    await expect(page.locator("text=Duedilis").first()).toBeVisible(); // sidebar/header brand
  });

  test("login with wrong password → error message shown", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.locator('input[name="password"]').fill("wrongpassword");
    await page.click('button[type="submit"]');
    await expect(
      page.locator("text=Email ou palavra-passe incorretos"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("login with non-existent user → error message shown", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.locator('input[name="password"]').fill("anypassword");
    await page.click('button[type="submit"]');
    await expect(
      page.locator("text=Email ou palavra-passe incorretos"),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("access / without auth → redirect to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sidebar navigation works", async ({ page }) => {
    await loginAsAdmin(page);

    // navigate via sidebar
    await page.click("text=Projetos");
    await expect(page).toHaveURL("/projects");
    await page.click("text=Issues");
    await expect(page).toHaveURL("/issues");
    await page.click("text=Documentos");
    await expect(page).toHaveURL("/documents");
  });

  test("logout → redirect to login", async ({ page }) => {
    await loginAsAdmin(page);
    await page.click("text=Sair");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
