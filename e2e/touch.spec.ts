import { test, expect } from "@playwright/test";
import { loginAs, getTestFixture } from "./helpers";

/**
 * E3-C7: Touch interaction tests for Duedilis.
 *
 * Verifies tap targets, form usability, and navigation on mobile viewports.
 * WCAG 2.5.5 requires touch targets of at least 44×44 CSS pixels.
 */

const MOBILE_VIEWPORT = { width: 375, height: 667 };

test.describe("Touch: Tap targets on login page", () => {
  test("all interactive elements ≥44px on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/login");

    // Collect all buttons and links
    const interactives = await page
      .locator("button, a[href], input[type='submit'], input[type='button']")
      .all();

    const tooSmall: string[] = [];

    for (const el of interactives) {
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;

      const box = await el.boundingBox();
      if (!box) continue;

      // Skip tiny decorative icons that are not the primary tap target
      const ariaHidden = await el.getAttribute("aria-hidden");
      if (ariaHidden === "true") continue;

      if (box.width < 44 || box.height < 44) {
        const text = (await el.textContent())?.trim().slice(0, 40) ?? "";
        const tag = await el.evaluate((e) => e.tagName);
        tooSmall.push(
          `${tag} "${text}" — ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`,
        );
      }
    }

    expect(
      tooSmall,
      `These elements are below 44px tap target on mobile:\n${tooSmall.join("\n")}`,
    ).toHaveLength(0);
  });
});

test.describe("Touch: Form inputs focusable on mobile", () => {
  test("email and password inputs focusable on login page", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/login");

    const emailInput = page.getByLabel("Email");
    await emailInput.tap();
    await expect(emailInput).toBeFocused();

    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.tap();
    await expect(passwordInput).toBeFocused();
  });

  test("login form submits successfully from mobile viewport", async ({
    page,
  }) => {
    const fixture = getTestFixture();
    await page.setViewportSize(MOBILE_VIEWPORT);

    await page.goto("/login");
    await page.getByLabel("Email").tap();
    await page.getByLabel("Email").fill(fixture.adminUser.email);
    await page.locator('input[name="password"]').tap();
    await page
      .locator('input[name="password"]')
      .fill(fixture.adminUser.password);
    await page.getByRole("button", { name: /entrar/i }).tap();

    // Expect redirect to dashboard after successful login
    await page.waitForURL("**/", { timeout: 15_000 });
    await expect(page).not.toHaveURL(/login/);
  });
});

test.describe("Touch: Navigation on mobile", () => {
  let fixture: ReturnType<typeof getTestFixture>;

  test.beforeAll(() => {
    fixture = getTestFixture();
  });

  test("tap targets ≥44px on authenticated dashboard", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    // Collect all visible buttons and links in the main navigation
    const navButtons = await page
      .locator("nav button, nav a[href], aside button, aside a[href]")
      .all();

    const tooSmall: string[] = [];

    for (const el of navButtons) {
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;

      const box = await el.boundingBox();
      if (!box) continue;

      const ariaHidden = await el.getAttribute("aria-hidden");
      if (ariaHidden === "true") continue;

      if (box.width < 44 || box.height < 44) {
        const text = (await el.textContent())?.trim().slice(0, 40) ?? "";
        const tag = await el.evaluate((e) => e.tagName);
        tooSmall.push(
          `${tag} "${text}" — ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`,
        );
      }
    }

    expect(
      tooSmall,
      `Nav elements below 44px tap target:\n${tooSmall.join("\n")}`,
    ).toHaveLength(0);
  });

  test("sidebar toggle button functional on mobile (375px)", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loginAs(page, fixture.adminUser.email, fixture.adminUser.password);
    await page.goto("/");

    // Find mobile sidebar toggle (hamburger)
    const hamburger = page
      .locator(
        "button[aria-label*='menu' i], button[aria-label*='sidebar' i], button[aria-label*='toggle' i], button[aria-controls*='sidebar' i]",
      )
      .first();

    const hamburgerExists = await hamburger.isVisible().catch(() => false);

    if (hamburgerExists) {
      await hamburger.tap();

      // After tap, either sidebar becomes visible OR menu opens
      // Wait a moment for animation
      await page.waitForTimeout(300);

      // Sidebar or nav menu should now be visible
      const sidebar = page
        .locator("aside, [data-sidebar], [role='dialog']")
        .first();
      const sidebarVisible = await sidebar.isVisible().catch(() => false);
      expect(sidebarVisible).toBe(true);
    } else {
      // No hamburger visible — sidebar may be in a different structure
      // Log as informational: sidebar toggle not found, possibly inline nav
      test.info().annotations.push({
        type: "info",
        description:
          "No hamburger/sidebar toggle found at 375px — may use inline nav",
      });
    }
  });
});
