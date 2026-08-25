import { test, expect } from "@playwright/test";

async function bypassAgeGate(page) {
  await page.addInitScript(() => localStorage.setItem("age_verified", "e2e-skip-link"));
}

const skipRoutes = ["/", "/prompts", "/tools", "/compare", "/community", "/docs/sillytavern"];

test.describe("skip link — keyboard Enter activation", () => {
  for (const route of skipRoutes) {
    test(`Enter on ${route}: focus moves to main and Tab continues into content`, async ({ page }) => {
      await bypassAgeGate(page);
      await page.goto(route);
      await page.waitForSelector("main#main-content", { state: "visible" });

      // Tab reaches skip link first
      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", { name: "Skip to main content" });
      await expect(skipLink).toBeFocused();

      // Enter activates native fragment navigation
      await page.keyboard.press("Enter");

      // Focus must land on main#main-content
      const activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe("main-content");

      // Focus must persist after settling
      await page.waitForTimeout(300);
      const activeIdPersisted = await page.evaluate(() => document.activeElement?.id);
      expect(activeIdPersisted).toBe("main-content");

      // URL must contain #main-content
      await expect(page).toHaveURL(/#main-content/);

      // Next Tab must NOT land in header/nav — must land inside or after main
      await page.keyboard.press("Tab");
      const nextTag = await page.evaluate(() => {
        const el = document.activeElement;
        const header = document.querySelector("header, nav");
        if (!header) return "no-header";
        // Check if active element is inside header
        return header.contains(el) ? "header" : "content";
      });
      expect(nextTag).toBe("content");
    });
  }
});

test.describe("skip link — pointer click activation", () => {
  for (const route of ["/", "/compare"]) {
    test(`click on ${route}: focus moves to main`, async ({ page }) => {
      await bypassAgeGate(page);
      await page.goto(route);
      await page.waitForSelector("main#main-content", { state: "visible" });

      const skipLink = page.getByRole("link", { name: "Skip to main content" });
      await skipLink.focus();
      await skipLink.click();

      await page.waitForTimeout(300);
      const activeId = await page.evaluate(() => document.activeElement?.id);
      expect(activeId).toBe("main-content");
      await expect(page).toHaveURL(/#main-content/);

      // Next Tab continues in content, not header
      await page.keyboard.press("Tab");
      const nextTag = await page.evaluate(() => {
        const el = document.activeElement;
        const header = document.querySelector("header, nav");
        if (!header) return "no-header";
        return header.contains(el) ? "header" : "content";
      });
      expect(nextTag).toBe("content");
    });
  }
});

test.describe("skip link — Space key does not break navigation", () => {
  test("Space on / does not activate skip link", async ({ page }) => {
    await bypassAgeGate(page);
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Space");

    // Focus stays on skip link (Space does not activate native links)
    await expect(skipLink).toBeFocused();
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).not.toBe("#main-content");

    // Subsequent Enter still works
    await page.keyboard.press("Enter");
    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("main-content");
  });

  test("Space on /compare does not break state", async ({ page }) => {
    await bypassAgeGate(page);
    await page.goto("/compare");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Space");
    await expect(skipLink).toBeFocused();

    // Enter still works after Space
    await page.keyboard.press("Enter");
    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("main-content");
  });
});

test.describe("skip link — first focusable element", () => {
  for (const route of skipRoutes) {
    test(`skip link is first Tab stop on ${route}`, async ({ page }) => {
      await bypassAgeGate(page);
      await page.goto(route);
      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", { name: "Skip to main content" });
      await expect(skipLink).toBeFocused();
    });
  }
});

test.describe("skip link — not persistently visible", () => {
  test("skip link is not a persistent Tab stop on /", async ({ page }) => {
    await bypassAgeGate(page);
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });

    // Focus skip link (first Tab)
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();

    // After more Tabs, focus should be past skip link
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focused).not.toBe("Skip to main content");

    // Skip link should not be a normal stop in subsequent Tab cycles
    const isStop = await page.evaluate(() => {
      const skipLink = document.querySelector('a[href="#main-content"]');
      // sr-only elements have tabindex implicitly but are not in normal tab order
      return skipLink?.getAttribute("tabindex");
    });
    // Skip link should not have a positive tabindex
    expect(isStop === null || isStop === "-1").toBeTruthy();
  });
});

test.describe("skip link — single main#main-content per route", () => {
  for (const route of skipRoutes) {
    test(`unique main#main-content on ${route}`, async ({ page }) => {
      await bypassAgeGate(page);
      await page.goto(route);
      const count = await page.locator("main#main-content").count();
      expect(count).toBe(1);

      // Confirm tabIndex={-1} is set
      const tabIndex = await page.locator("main#main-content").getAttribute("tabindex");
      expect(tabIndex).toBe("-1");
    });
  }
});
