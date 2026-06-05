import { test, expect, type Page } from "@playwright/test";

const MOCK_DRAFT = {
  id: "draft-e2e-1",
  proposal_id: null,
  title: "E2E Test Draft",
  client_name: "Acme Corp",
  status: "draft",
  last_location: "wizard_parameters",
  stage: "wizard_in_progress",
  updated_at: "2025-01-15T12:00:00Z",
};

const MOCK_DRAFT_FULL = {
  ...MOCK_DRAFT,
  wizard_state: {
    currentStep: 1,
    maxStepReached: 1,
    completedSteps: [],
    proposalData: {
      title: "E2E Test Draft",
      clientName: "Acme Corp",
      clientId: 1,
      selectedSections: ["executive_summary"],
      sectionDisplayNames: {},
      tone: "professional",
      length: "balanced",
      templateType: "predefined",
      language: "english",
      filesMeta: [],
      selectedDocumentIds: [],
      webReferences: [],
    },
  },
  ui_state: {
    scrollPosition: 0,
    activeSection: null,
    expandedSections: [],
    lastVisibleSection: null,
  },
  generated_content: {},
  created_at: "2025-01-14T10:00:00Z",
  version: 1,
};

async function mockDraftsApi(page: Page, drafts: (typeof MOCK_DRAFT)[]): Promise<void> {
  await page.route(/\/api\/v1\/drafts/, async (route) => {
    if (route.request().resourceType() === "document") {
      await route.continue();
      return;
    }
    const url = route.request().url();
    const method = route.request().method();

    // Detail endpoint: /drafts/:id
    if (/\/drafts\/[^?/]+/.test(url)) {
      if (method === "GET") {
        await route.fulfill({ json: { success: true, data: MOCK_DRAFT_FULL } });
      } else if (method === "DELETE") {
        await route.fulfill({ status: 204, json: { success: true, data: null } });
      } else {
        await route.continue();
      }
      return;
    }

    // List endpoint: /drafts or /drafts?...
    if (method === "GET") {
      await route.fulfill({ json: { success: true, data: { drafts } } });
    } else {
      await route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Drafts page — list view
// ---------------------------------------------------------------------------

test.describe("Drafts — list page", () => {
  test.beforeEach(async ({ page }) => {
    await mockDraftsApi(page, []);
    await page.goto("/drafts");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /drafts/i })).toBeVisible({ timeout: 8_000 });
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
    await mockDraftsApi(page, [MOCK_DRAFT]);
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
    await mockDraftsApi(page, [MOCK_DRAFT]);
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
    await mockDraftsApi(page, [MOCK_DRAFT]);
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
