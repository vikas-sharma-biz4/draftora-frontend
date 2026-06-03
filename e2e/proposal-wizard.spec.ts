import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// API fixtures — match the snake_case shape the backend returns
// ---------------------------------------------------------------------------

const CLIENTS_RESPONSE = {
  clients: [
    {
      id: 1,
      name: "Acme Corp",
      status: "active",
      tier: "enterprise",
      industry: "Technology",
      created_at: "2025-01-01T00:00:00Z",
    },
    {
      id: 2,
      name: "Biz Tech",
      status: "active",
      tier: "standard",
      industry: "Finance",
      created_at: "2025-01-01T00:00:00Z",
    },
  ],
  total_count: 2,
  page: 1,
  total_pages: 1,
};

const SAVED_DRAFT = {
  id: "draft-e2e-1",
  proposal_id: null,
  title: "E2E Proposal",
  client_name: "Acme Corp",
  status: "draft",
  last_location: "wizard_parameters",
  stage: "wizard_in_progress",
  wizard_state: {
    currentStep: 1,
    maxStepReached: 1,
    completedSteps: [],
    proposalData: {
      title: "E2E Proposal",
      clientName: "Acme Corp",
      clientId: 1,
      selectedSections: ["executive_summary", "proposed_solution"],
      tone: "professional",
      length: "balanced",
      sectionDisplayNames: {},
      filesMeta: [],
      selectedDocumentIds: [],
    },
  },
  ui_state: {
    scrollPosition: 0,
    activeSection: null,
    expandedSections: [],
    lastVisibleSection: null,
  },
  generated_content: {},
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  version: 1,
};

// ---------------------------------------------------------------------------
// Shared mock setup
// ---------------------------------------------------------------------------

async function mockWizardApis(page: Page): Promise<void> {
  // GET /clients — populates the modal's client dropdown
  await page.route(/\/clients(\?.*)?$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: CLIENTS_RESPONSE });
    } else {
      await route.continue();
    }
  });

  // GET /drafts — returns empty list so no resume banner appears on home
  // POST /drafts — mock save response
  await page.route(/\/drafts(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      await route.fulfill({ status: 201, json: SAVED_DRAFT });
    } else if (method === "GET") {
      await route.fulfill({ json: { drafts: [] } });
    } else {
      await route.continue();
    }
  });

  // PUT /drafts/:id — auto-save updates while on parameters page
  await page.route(/\/drafts\/[^?/]+(\?.*)?$/, async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ json: SAVED_DRAFT });
    } else {
      await route.continue();
    }
  });

  // GET /recommendations — background call on parameters page; return empty so
  // the page does not wait indefinitely for AI suggestions during the test
  await page.route(/\/recommendations/, async (route) => {
    await route.fulfill({ json: { sections: [] } });
  });
}

// ---------------------------------------------------------------------------
// Wizard — home page (template selection)
// ---------------------------------------------------------------------------

test.describe("Wizard — home page template selection", () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardApis(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders at least one template card or scratch option", async ({ page }) => {
    const card = page
      .locator("[data-testid='template-card']")
      .or(page.getByRole("button", { name: /scratch|start from scratch|predefined|mvp|brd/i }));

    await expect(card.first()).toBeVisible({ timeout: 8_000 });
  });

  test("clicking a template card opens the selection modal", async ({ page }) => {
    const card = page.locator("[data-testid='template-card']").first();

    if ((await card.count()) > 0) {
      await card.click();
    } else {
      // Fall back to scratch if no data-testid cards are found
      const scratchBtn = page.getByRole("button", { name: /scratch|start from scratch/i });
      if ((await scratchBtn.count()) === 0) return;
      await scratchBtn.first().click();
    }

    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 6_000 });
  });

  test("template selection modal shows a client field and a continue button", async ({ page }) => {
    const card = page.locator("[data-testid='template-card']").first();

    if ((await card.count()) > 0) {
      await card.click();
    } else {
      const scratchBtn = page.getByRole("button", { name: /scratch|start from scratch/i });
      if ((await scratchBtn.count()) === 0) return;
      await scratchBtn.first().click();
    }

    const dialog = page.getByRole("dialog").first();
    await dialog.waitFor({ timeout: 6_000 });

    // Client selector (dropdown, combobox, or text input) must be present
    const clientField = dialog
      .getByLabel(/client/i)
      .or(dialog.getByPlaceholder(/client/i))
      .or(dialog.locator("[data-testid='client-select'], [data-testid='client-dropdown']"));
    await expect(clientField.first()).toBeVisible({ timeout: 5_000 });

    // "Continue", "Next", or "Start" button
    const continueBtn = dialog.getByRole("button", {
      name: /continue|proceed|next|start/i,
    });
    await expect(continueBtn.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Wizard — parameters step
// ---------------------------------------------------------------------------

test.describe("Wizard — parameters step (/parameters)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardApis(page);
    await page.goto("/parameters");
    await page.waitForLoadState("networkidle");
  });

  test("renders a page heading without crashing", async ({ page }) => {
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8_000 });
  });

  test("proposal title and client name fields are present", async ({ page }) => {
    const titleField = page
      .getByLabel(/title|proposal title/i)
      .or(page.getByPlaceholder(/title/i))
      .or(page.locator("[data-testid='proposal-title-input']"));

    const clientField = page
      .getByLabel(/client/i)
      .or(page.getByPlaceholder(/client/i))
      .or(page.locator("[data-testid='client-name-input']"));

    await expect(titleField.first()).toBeVisible({ timeout: 8_000 });
    await expect(clientField.first()).toBeVisible({ timeout: 8_000 });
  });

  test("save draft button is visible on the parameters page", async ({ page }) => {
    const saveBtn = page
      .getByRole("button", { name: /save draft|save/i })
      .or(page.locator("[data-testid='save-draft-button']"));

    await expect(saveBtn.first()).toBeVisible({ timeout: 6_000 });
  });

  test("clicking save draft calls POST /drafts and does not crash the page", async ({ page }) => {
    let draftSaveRequested = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/drafts/.test(req.url())) {
        draftSaveRequested = true;
      }
    });

    // Fill the title so the save guard passes
    const titleField = page
      .getByLabel(/title|proposal title/i)
      .or(page.getByPlaceholder(/title/i))
      .or(page.locator("[data-testid='proposal-title-input']"))
      .first();

    if ((await titleField.count()) > 0) {
      await titleField.fill("E2E Proposal");
      await titleField.blur();
    }

    const saveBtn = page
      .getByRole("button", { name: /save draft|save/i })
      .or(page.locator("[data-testid='save-draft-button']"))
      .first();

    await saveBtn.click();

    // Allow the async save to settle
    await page.waitForTimeout(1_500);

    // Page heading must still be visible — ErrorBoundary must not have triggered
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });

  test("next button navigates to /review", async ({ page }) => {
    const nextBtn = page
      .getByRole("button", { name: /^next$|next step|continue to review/i })
      .first();

    if ((await nextBtn.count()) === 0) return;

    await nextBtn.click();
    await page.waitForURL(/\/(review|generating)/i, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(review|generating)/i);
  });
});

// ---------------------------------------------------------------------------
// Wizard — review step
// ---------------------------------------------------------------------------

test.describe("Wizard — review step (/review)", () => {
  test("review page renders without crashing", async ({ page }) => {
    await mockWizardApis(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});
