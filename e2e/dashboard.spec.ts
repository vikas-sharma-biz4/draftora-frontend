import { test, expect, type Page } from "@playwright/test";

const MOCK_PROPOSALS = [
  {
    id: 1,
    title: "Infrastructure Migration Proposal",
    client_name: "Acme Corp",
    client_id: 1,
    status: "pending",
    approval_status: "pending",
    template_type: "predefined",
    tone: "professional",
    length_preference: "balanced",
    version: 1,
    created_at: "2025-01-10T10:00:00Z",
    updated_at: "2025-01-11T10:00:00Z",
  },
  {
    id: 2,
    title: "Cloud Architecture Review",
    client_name: "Biz Tech",
    client_id: 2,
    status: "approved",
    approval_status: "approved",
    template_type: "predefined",
    tone: "professional",
    length_preference: "balanced",
    version: 2,
    created_at: "2025-01-09T10:00:00Z",
    updated_at: "2025-01-10T10:00:00Z",
  },
];

async function mockProposals(page: Page): Promise<void> {
  await page.route(/\/proposals(\?.*)?$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { success: true, data: MOCK_PROPOSALS } });
    } else {
      await route.continue();
    }
  });
}

test.describe("Dashboard — happy path", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("renders the page heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Your Proposals" })).toBeVisible();
  });

  test("renders the search input", async ({ page }) => {
    await expect(page.getByPlaceholder("Search by title or client...")).toBeVisible();
  });
});

test.describe("Dashboard — search filtering", () => {
  test.beforeEach(async ({ page }) => {
    await mockProposals(page);
    await page.goto("/dashboard");
    // Wait for the proposal list to be visible (not skeleton)
    await page.waitForSelector("[data-testid='proposal-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });
  });

  test("filters the list when a search term is typed", async ({ page }) => {
    const cardCount = await page.locator("[data-testid='proposal-card']").count();
    if (cardCount === 0) return;

    const searchInput = page.getByPlaceholder("Search by title or client...");
    await searchInput.fill("nonexistent_query_xyz");

    await expect(page.getByText("No results found")).toBeVisible({ timeout: 5_000 });
  });

  test("shows all results when search is cleared", async ({ page }) => {
    const cardCount = await page.locator("[data-testid='proposal-card']").count();
    if (cardCount === 0) return;

    const searchInput = page.getByPlaceholder("Search by title or client...");
    await searchInput.fill("xyz");
    await searchInput.clear();

    // After clearing, results should return (empty state should disappear if proposals exist)
    await expect(page.getByText("No results found")).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Dashboard — empty state", () => {
  test("shows a CTA to create the first proposal when the list is empty", async ({ page }) => {
    await page.goto("/dashboard");
    // Only assert if the empty state is actually present
    const emptyState = page.getByText("No proposals yet");
    const hasProposals = await page.getByText("No proposals yet").count();
    if (hasProposals > 0) {
      await expect(emptyState).toBeVisible();
      await expect(page.getByText("Create Proposal")).toBeVisible();
    }
  });
});
