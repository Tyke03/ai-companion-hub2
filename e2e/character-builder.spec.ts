import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const V1_FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/v1-card.json"), "utf-8"),
);
const V2_FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/v2-card.json"), "utf-8"),
);

async function openCharacterBuilder(page) {
  await page.goto("/tools");
  // Click through age verification if present
  const ageButton = page.getByRole("button", { name: /18 or older/i });
  if (await ageButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ageButton.click();
  }
  await page.getByRole("tab", { name: /Character Builder/ }).click();
  await expect(
    page.getByRole("heading", { name: "Character Card Builder" }),
  ).toBeVisible();
}

async function openTextImport(page) {
  await page.getByRole("button", { name: "Import (Text)" }).click();
  await expect(page.getByPlaceholder("Paste character data here...")).toBeVisible();
}

/* 1. Loading */
test.describe("Character Builder loading", () => {
  test("loads builder with core form and import controls", async ({ page }) => {
    await openCharacterBuilder(page);
    await expect(page.getByPlaceholder("Luna Starweaver")).toBeVisible();
    await expect(page.getByPlaceholder(/mysterious sorceress/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Confident, seductive/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Import (Text)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import (File/PNG)" })).toBeVisible();
    await expect(page.getByText("V3 (draft)")).toBeVisible();
    await expect(page.getByText("chara_card_v2 — stable")).toBeVisible();
  });
});

/* 2. Invalid / unrecognized input */
test.describe("Invalid and unrecognized text import", () => {
  test.beforeEach(async ({ page }) => {
    await openCharacterBuilder(page);
    await openTextImport(page);
  });

  test("rejects plain text", async ({ page }) => {
    const ta = page.getByPlaceholder("Paste character data here...");
    await ta.fill("not valid json");
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText("Not valid JSON").first()).toBeVisible();
    await expect(ta).toBeVisible();
    await expect(ta).toHaveValue("not valid json");
    await expect(page.getByPlaceholder("Luna Starweaver")).toHaveValue("");
  });

  test("rejects {foo:bar} JSON", async ({ page }) => {
    const ta = page.getByPlaceholder("Paste character data here...");
    await ta.fill('{"foo":"bar"}');
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText("Not a recognized card").first()).toBeVisible();
    await expect(page.getByPlaceholder("Luna Starweaver")).toHaveValue("");
  });

  test("rejects partial {name only}", async ({ page }) => {
    const ta = page.getByPlaceholder("Paste character data here...");
    await ta.fill('{"name":"only a name"}');
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText("Not a recognized card").first()).toBeVisible();
    await expect(page.getByPlaceholder("Luna Starweaver")).toHaveValue("");
  });

  test("rejects non-object JSON", async ({ page }) => {
    const ta = page.getByPlaceholder("Paste character data here...");
    await ta.fill('["array"]');
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText("Not a recognized card").first()).toBeVisible();
    await expect(page.getByPlaceholder("Luna Starweaver")).toHaveValue("");
  });
});

/* 3. V1 import */
test.describe("V1 text import", () => {
  test("imports V1 fixture and shows upgrade notice", async ({ page }) => {
    await openCharacterBuilder(page);
    await openTextImport(page);

    const ta = page.getByPlaceholder("Paste character data here...");
    await ta.fill(JSON.stringify(V1_FIXTURE));
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByText("V1 card loaded").first()).toBeVisible();
    await expect(page.getByPlaceholder("Luna Starweaver")).toHaveValue("QA V1 Card");
    await expect(page.getByPlaceholder(/mysterious sorceress/i)).toHaveValue("Synthetic QA fixture for E2E tests.");
    await expect(page.getByText(/export as V2.*upgraded/i).first()).toBeVisible();
  });
});

/* 4. V2 import and preservation notices */
test.describe("V2 text import and preservation notices", () => {
  test("imports V2 fixture with preservation notices", async ({ page }) => {
    await openCharacterBuilder(page);
    await openTextImport(page);

    const ta = page.getByPlaceholder("Paste character data here...");
    await ta.fill(JSON.stringify(V2_FIXTURE));
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByPlaceholder("Luna Starweaver")).toHaveValue("QA V2 Card");
    await expect(page.getByText(/Imported as V2/i)).toBeVisible();
    await expect(page.getByText(/character.book.*preserved/i)).toBeVisible();
    await expect(page.getByText(/unsupported field/i)).toBeVisible();
  });
});

/* 5. V3 draft UI */
test.describe("V3 draft UI", () => {
  test("shows draft labels and asset editor", async ({ page }) => {
    await openCharacterBuilder(page);

    const v3Draft = page.getByText("V3 (draft)");
    await expect(v3Draft).toBeVisible();

    // Switch to V3
    await page.locator('button[role="switch"]').click();
    await page.waitForTimeout(300);

    await expect(page.getByText("chara_card_v3 (draft spec)")).toBeVisible();
    await expect(page.getByText("Assets (V3 draft)")).toBeVisible();

    // Add an asset
    await page.getByRole("button", { name: "Add asset declaration" }).click();

    // Check asset fields exist
    await expect(page.getByLabel("Asset 1 type")).toBeVisible();
    await expect(page.getByLabel("Asset 1 name")).toBeVisible();
    await expect(page.getByLabel("Asset 1 URI")).toBeVisible();
    await expect(page.getByLabel("Asset 1 extension")).toBeVisible();

    // Export labels mention draft
    await expect(page.getByRole("button", { name: /Copy V3.*draft.*JSON/ })).toBeVisible();
  });
});

/* 6. Mobile viewport */
test.describe("Mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("import dialog and notices have no horizontal overflow", async ({ page }) => {
    await openCharacterBuilder(page);
    await openTextImport(page);

    const ta = page.getByPlaceholder("Paste character data here...");
    await expect(ta).toBeVisible();

    // Import V2 to trigger preservation notices
    await ta.fill(JSON.stringify(V2_FIXTURE));
    await page.getByRole("button", { name: "Import", exact: true }).click();

    // Verify notices visible without overflow
    await expect(page.getByText(/character.book.*preserved/i)).toBeVisible();

    // Check no element overflows horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 2); // small tolerance
  });
});

/* 7. Download checks (sanity only — no file-picker automation) */
test.describe("Export controls", () => {
  test("download buttons visible with correct labels", async ({ page }) => {
    await openCharacterBuilder(page);

    // Fill minimal card so export is meaningful
    await page.getByPlaceholder("Luna Starweaver").fill("Export Test");

    await expect(
      page.getByRole("button", { name: /Copy V2 JSON/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Download JSON" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Export as PNG" }),
    ).toBeVisible();
  });
});
