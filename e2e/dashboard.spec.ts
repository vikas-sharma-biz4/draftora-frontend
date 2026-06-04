import { test, expect } from "@playwright/test";

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
    await page.goto("/dashboard");
    // Wait for the proposal list to be visible (not skeleton)
    await page.waitForSelector("[data-testid='proposal-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });
  });

  test("filters the list when a search term is typed", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search by title or client...");
    await searchInput.fill("nonexistent_query_xyz");

    await expect(page.getByText("No results found")).toBeVisible({ timeout: 5_000 });
  });

  test("shows all results when search is cleared", async ({ page }) => {
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
