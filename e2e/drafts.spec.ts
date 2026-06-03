import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Drafts page — list view
// ---------------------------------------------------------------------------

test.describe("Drafts — list page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/drafts");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /drafts/i })).toBeVisible();
  });

  test("shows draft cards or empty state — never a blank screen", async ({ page }) => {
    await page.waitForSelector("[data-testid='draft-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    const hasDrafts = (await page.locator("[data-testid='draft-card']").count()) > 0;
    const hasEmpty = (await page.locator("[data-testid='empty-state']").count()) > 0;

    expect(hasDrafts || hasEmpty).toBe(true);
  });

  test("empty state has a CTA to create a proposal when no drafts exist", async ({ page }) => {
    await page.waitForSelector("[data-testid='draft-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    const hasEmpty = (await page.locator("[data-testid='empty-state']").count()) > 0;

    if (!hasEmpty) return;

    const cta = page
      .getByRole("button", { name: /create proposal|new proposal|start/i })
      .or(page.getByRole("link", { name: /create proposal|new proposal|start/i }));

    await expect(cta.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Drafts — resume flow
// ---------------------------------------------------------------------------

test.describe("Drafts — resume flow", () => {
  test("resume button is present on existing draft cards", async ({ page }) => {
    await page.goto("/drafts");

    await page.waitForSelector("[data-testid='draft-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    const hasDrafts = (await page.locator("[data-testid='draft-card']").count()) > 0;

    if (!hasDrafts) return;

    const resumeButton = page
      .getByRole("button", { name: /resume|continue|edit/i })
      .or(page.getByRole("link", { name: /resume|continue|edit/i }));

    await expect(resumeButton.first()).toBeVisible();
  });

  test("clicking resume navigates into the wizard", async ({ page }) => {
    await page.goto("/drafts");

    await page.waitForSelector("[data-testid='draft-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    if ((await page.locator("[data-testid='draft-card']").count()) === 0) return;

    const resumeButton = page
      .getByRole("button", { name: /resume|continue|edit/i })
      .or(page.getByRole("link", { name: /resume|continue|edit/i }));

    await resumeButton.first().click();

    // Should land somewhere in the wizard or proposal flow
    await page.waitForURL(/\/(parameters|template|wizard|proposal)/i, { timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Drafts — delete flow
// ---------------------------------------------------------------------------

test.describe("Drafts — delete flow", () => {
  test("delete button or menu is present on existing draft cards", async ({ page }) => {
    await page.goto("/drafts");

    await page.waitForSelector("[data-testid='draft-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    if ((await page.locator("[data-testid='draft-card']").count()) === 0) return;

    const deleteControl = page
      .getByRole("button", { name: /delete|remove/i })
      .or(page.locator("[data-testid='draft-menu'], [data-testid='draft-actions']").first());

    await expect(deleteControl.first()).toBeVisible();
  });
});
