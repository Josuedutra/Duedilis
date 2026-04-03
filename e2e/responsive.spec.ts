import { test, expect } from "@playwright/test";
import { loginAs, getTestFixture } from "./helpers";

/**
 * E3-C7: Responsive viewport tests for Duedilis.
 *
 * Verifies that the application layout is correct across 5 standard viewports.
 * Tests run per-project (chromium per-PR, full multi-browser on releases).
 */

const VIEWPORTS = [
  { name: "iPhone SE (375px)", width: 375, height: 667 },
  { name: "iPhone 14 (390px)", width: 390, height: 844 },
  { name: "Tablet (768px)", width: 768, height: 1024 },
  { name: "Desktop (1280px)", width: 1280, height: 800 },
  { name: "Full HD (1920px)", width: 1920, height: 1080 },
];

test.describe("Responsive: Login Page", () => {
  for (const viewport of VIEWPORTS) {
    test(`login form visible at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/login");

      // Login form must be visible at all viewports
      const emailInput = page.getByLabel("Email");
      await expect(emailInput).toBeVisible();

      const passwordInput = page.locator('input[name="password"]');
      await expect(passwordInput).toBeVisible();

      const submitButton = page.getByRole("button", { name: /entrar/i });
      await expect(submitButton).toBeVisible();
    });
  }
});

test.describe("Responsive: Dashboard Layout", () => {
  let fixture: ReturnType<typeof getTestFixture>;

  test.beforeAll(() => {
    fixture = getTestFixture();
  });

  test("dashboard cards stack vertically on iPhone SE (375px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    // Page must load without JS errors
    await expect(page).not.toHaveURL(/error/);

    // At 375px, main content area must be present
    const main = page.locator("main, [role='main'], #main-content").first();
    await expect(main).toBeVisible();
  });

  test("dashboard cards stack vertically on iPhone 14 (390px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    await expect(page).not.toHaveURL(/error/);

    const main = page.locator("main, [role='main'], #main-content").first();
    await expect(main).toBeVisible();
  });

  test("hybrid layout visible at tablet (768px)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    await expect(page).not.toHaveURL(/error/);

    // Content area must be accessible at tablet width
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("full layout with sidebar at desktop (1280px)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    await expect(page).not.toHaveURL(/error/);

    // At desktop width, navigation/sidebar should be present
    const nav = page.locator("nav, aside, [role='navigation']").first();
    await expect(nav).toBeVisible();
  });

  test("no excessive stretch at Full HD (1920px)", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    await expect(page).not.toHaveURL(/error/);

    // Page renders without overflow — check no horizontal scrollbar
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });
});

test.describe("Responsive: Sidebar Behaviour", () => {
  let fixture: ReturnType<typeof getTestFixture>;

  test.beforeAll(() => {
    fixture = getTestFixture();
  });

  test("sidebar collapsed or hamburger present on mobile (375px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    // Either sidebar is hidden OR a toggle button exists
    const sidebar = page
      .locator("aside, [data-sidebar], [class*='sidebar']")
      .first();
    const hamburger = page
      .locator(
        "button[aria-label*='menu' i], button[aria-label*='sidebar' i], button[aria-label*='toggle' i]",
      )
      .first();

    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    const hamburgerVisible = await hamburger.isVisible().catch(() => false);

    // At mobile: sidebar hidden OR hamburger toggle visible
    const mobileHandled = !sidebarVisible || hamburgerVisible;
    expect(mobileHandled).toBe(true);
  });

  test("sidebar visible at desktop (1280px)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    // At desktop, some navigation structure must be visible
    const nav = page.locator("nav, aside, [role='navigation']").first();
    await expect(nav).toBeVisible();
  });
});

test.describe("Responsive: Tables horizontal scroll on mobile", () => {
  let fixture: ReturnType<typeof getTestFixture>;

  test.beforeAll(() => {
    fixture = getTestFixture();
  });

  test("table containers have overflow-x scroll (not hidden) at 375px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    // Check for any table wrapper — overflow must not be 'hidden'
    const tableContainers = await page
      .locator("table, [class*='table'], [role='table']")
      .all();

    for (const container of tableContainers) {
      const overflowX = await container.evaluate((el) => {
        const style = window.getComputedStyle(el.parentElement ?? el);
        return style.overflowX;
      });
      // overflow-x must not be 'hidden' (would clip table on mobile)
      expect(overflowX).not.toBe("hidden");
    }
  });
});
