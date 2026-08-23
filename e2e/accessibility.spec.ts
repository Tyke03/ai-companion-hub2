import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = ["/", "/prompts", "/compare", "/community"];

async function bypassAgeGate(page) {
  await page.addInitScript(() => localStorage.setItem("age_verified", "e2e-accessibility"));
}

async function openCharacterBuilder(page) {
  await bypassAgeGate(page);
  await page.goto("/tools");
  await page.getByRole("tab", { name: /Character Builder/ }).click();
  await expect(page.getByRole("heading", { name: "Character Card Builder" })).toBeVisible();
}

test.describe("automated accessibility scans", () => {
  for (const route of routes) {
    test(`has no axe violations on ${route}`, async ({ page }) => {
      await bypassAgeGate(page);
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .include("#root")
        .analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }

  test("has no axe violations on Character Builder", async ({ page }) => {
    await openCharacterBuilder(page);
    const results = await new AxeBuilder({ page })
      .include("#root")
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});

test.describe("Character Builder keyboard and focus", () => {
  test("opens Import Text with keyboard, traps focus, and restores focus", async ({ page }) => {
    await openCharacterBuilder(page);
    const trigger = page.getByRole("button", { name: "Import (Text)" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Import Character Card JSON" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Character Card JSON" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Import", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("announces invalid import errors and preserves the dialog input", async ({ page }) => {
    await openCharacterBuilder(page);
    const trigger = page.getByRole("button", { name: "Import (Text)" });
    await trigger.click();
    const textarea = page.getByRole("textbox", { name: "Character Card JSON" });
    await textarea.fill("not valid json");
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByRole("alert")).toContainText("Not valid JSON");
    await expect(textarea).toHaveValue("not valid json");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByPlaceholder("Luna Starweaver")).toHaveValue("");
  });

  test("exposes the V3 draft state and reaches primary controls on mobile", async ({ page }) => {
    await openCharacterBuilder(page);
    const versionSwitch = page.getByRole("switch", { name: "Use V3 draft format" });
    await expect(versionSwitch).toBeVisible();
    await expect(versionSwitch).toHaveAttribute("aria-checked", "false");
    await versionSwitch.press("Enter");
    await expect(versionSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("V3 (draft)", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import (File/PNG)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download JSON" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
