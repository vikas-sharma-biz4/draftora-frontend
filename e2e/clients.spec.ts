import { test, expect, type Page } from "@playwright/test";

const MOCK_CLIENTS_DATA = [
  {
    id: 1,
    name: "Acme Corp",
    industry: "Technology",
    status: "active",
    tier: "enterprise",
    documents: [],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Biz Tech",
    industry: "Finance",
    status: "active",
    tier: "standard",
    documents: [],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

async function mockClientsApi(page: Page): Promise<void> {
  await page.route(/\/api\/v1\/clients/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { success: true, data: MOCK_CLIENTS_DATA } });
    } else {
      await route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Clients page — list view
// ---------------------------------------------------------------------------

test.describe("Clients — list page", () => {
  test.beforeEach(async ({ page }) => {
    await mockClientsApi(page);
    await page.goto("/clients");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /clients/i })).toBeVisible();
  });

  test("renders a search or filter control", async ({ page }) => {
    // Search bar only appears when clients are loaded
    await page.waitForSelector("[data-testid='client-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });
    const search = page.getByPlaceholder(/search/i);
    await expect(search).toBeVisible();
  });

  test("shows client cards or empty state — never a blank screen", async ({ page }) => {
    await page.waitForSelector(
      "[data-testid='client-card'], [data-testid='empty-state'], [data-testid='client-row']",
      { timeout: 10_000 }
    );

    const hasClients =
      (await page.locator("[data-testid='client-card'], [data-testid='client-row']").count()) > 0;
    const hasEmpty = (await page.locator("[data-testid='empty-state']").count()) > 0;

    expect(hasClients || hasEmpty).toBe(true);
  });

  test("has a button or link to add a new client", async ({ page }) => {
    const addButton = page
      .getByRole("button", { name: /add client|new client|create client/i })
      .or(page.getByRole("link", { name: /add client|new client|create client/i }));

    await expect(addButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Clients — detail page
// ---------------------------------------------------------------------------

test.describe("Clients — detail page", () => {
  test("navigates to the first client detail page when a client exists", async ({ page }) => {
    await mockClientsApi(page);
    await page.goto("/clients");

    await page.waitForSelector(
      "[data-testid='client-card'], [data-testid='client-row'], [data-testid='empty-state']",
      { timeout: 10_000 }
    );

    const clientLink = page
      .getByRole("link", { name: /view|details/i })
      .or(page.locator("[data-testid='client-card']").first())
      .or(page.locator("[data-testid='client-row']").first());

    const count = await clientLink.count();

    if (count === 0) {
      // No clients exist — skip detail assertions
      return;
    }

    await clientLink.first().click();
    await page.waitForURL(/\/clients\/\d+/);

    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("detail page shows a documents section", async ({ page }) => {
    await mockClientsApi(page);
    await page.goto("/clients");

    await page.waitForSelector(
      "[data-testid='client-card'], [data-testid='client-row'], [data-testid='empty-state']",
      { timeout: 10_000 }
    );

    const clientLink = page
      .getByRole("link", { name: /view|details/i })
      .or(page.locator("[data-testid='client-card']").first())
      .or(page.locator("[data-testid='client-row']").first());

    if ((await clientLink.count()) === 0) return;

    await clientLink.first().click();
    await page.waitForURL(/\/clients\/\d+/);

    const documentsSection = page
      .getByText(/documents/i)
      .or(page.getByRole("heading", { name: /documents/i }));

    await expect(documentsSection.first()).toBeVisible({ timeout: 5_000 });
  });
});
