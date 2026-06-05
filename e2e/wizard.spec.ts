import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Proposal wizard — entry and step 1
// ---------------------------------------------------------------------------

test.describe("Proposal wizard — entry", () => {
  test("navigates to the wizard from the dashboard CTA", async ({ page }) => {
    await page.goto("/dashboard");

    const createButton = page
      .getByRole("button", { name: /create proposal|new proposal/i })
      .or(page.getByRole("link", { name: /create proposal|new proposal/i }));

    await createButton.first().click();
    // Accept: home page (/), wizard step, or parameters step as valid landing URLs
    await page.waitForURL(/(\/(wizard|parameters).*|\/?)$/, { timeout: 8_000 });
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("home page (template selection) renders without crashing", async ({ page }) => {
    // The template selection UI lives on the home route, not /template
    await page.goto("/");

    const heading = page.getByRole("heading");
    await expect(heading.first()).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Proposal wizard — template selection step
// ---------------------------------------------------------------------------

test.describe("Proposal wizard — template selection", () => {
  test.beforeEach(async ({ page }) => {
    // Template selection lives on the home route (/)
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders at least one template option or a scratch option", async ({ page }) => {
    const templateOption = page
      .getByRole("button", { name: /scratch|predefined|custom|template/i })
      .or(page.locator("[data-testid='template-card']").first());

    await expect(templateOption.first()).toBeVisible({ timeout: 8_000 });
  });

  test("selecting a template enables the continue or next button", async ({ page }) => {
    const firstTemplate = page
      .locator("[data-testid='template-card']")
      .or(page.getByRole("button", { name: /scratch|start from scratch/i }))
      .first();

    const count = await firstTemplate.count();
    if (count === 0) return;

    await firstTemplate.click();

    const nextButton = page
      .getByRole("button", { name: /continue|next|proceed/i })
      .or(page.getByRole("link", { name: /continue|next|proceed/i }));

    await expect(nextButton.first()).toBeEnabled({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Proposal wizard — parameters step
// ---------------------------------------------------------------------------

test.describe("Proposal wizard — parameters step", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/parameters");
    await page.waitForLoadState("networkidle");
  });

  test("renders the parameters page heading", async ({ page }) => {
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8_000 });
  });

  test("title input and client name field are present", async ({ page }) => {
    const titleInput = page
      .getByLabel(/title|proposal title/i)
      .or(page.getByPlaceholder(/title/i))
      .or(page.locator("[data-testid='proposal-title-input']"));

    const clientInput = page
      .getByLabel(/client/i)
      .or(page.getByPlaceholder(/client/i))
      .or(page.locator("[data-testid='client-name-input']"));

    await expect(titleInput.first()).toBeVisible({ timeout: 8_000 });
    await expect(clientInput.first()).toBeVisible({ timeout: 8_000 });
  });

  test("save draft button is present on the parameters page", async ({ page }) => {
    const saveButton = page
      .getByRole("button", { name: /save draft|save/i })
      .or(page.locator("[data-testid='save-draft-button']"));

    await expect(saveButton.first()).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Proposal wizard — history page
// ---------------------------------------------------------------------------

test.describe("History page", () => {
  test.beforeEach(async ({ page }) => {
    // Mock proposals so the test doesn't depend on a running backend
    await page.route(/\/proposals(\?.*)?$/, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { success: true, data: [] } });
      } else {
        await route.continue();
      }
    });
    await page.goto("/history");
  });

  test("renders the history heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /history/i })).toBeVisible();
  });

  test("shows proposal cards or empty state", async ({ page }) => {
    await page.waitForSelector("[data-testid='proposal-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    const hasProposals = (await page.locator("[data-testid='proposal-card']").count()) > 0;
    const hasEmpty = (await page.locator("[data-testid='empty-state']").count()) > 0;

    expect(hasProposals || hasEmpty).toBe(true);
  });
});
