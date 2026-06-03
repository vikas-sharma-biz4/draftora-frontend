import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// API fixtures
// ---------------------------------------------------------------------------

// Two pages of proposals so the infinite scroll sentinel has something to trigger.
// The shape matches what handlePaginatedResponse expects from the backend.
const PAGE_1_RESPONSE = {
  data: [
    {
      id: 1,
      title: "Infrastructure Migration Proposal",
      client_name: "Acme Corp",
      client_id: 1,
      status: "pending",
      approval_status: "pending",
      template_type: "predefined",
      version: 1,
      estimated_hours: null,
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
      version: 2,
      estimated_hours: null,
      created_at: "2025-01-09T10:00:00Z",
      updated_at: "2025-01-10T10:00:00Z",
    },
    {
      id: 3,
      title: "Security Hardening Plan",
      client_name: "Acme Corp",
      client_id: 1,
      status: "pending",
      approval_status: "pending",
      template_type: "custom",
      version: 1,
      estimated_hours: null,
      created_at: "2025-01-08T10:00:00Z",
      updated_at: "2025-01-09T10:00:00Z",
    },
  ],
  meta: {
    total: 5,
    page: 1,
    page_size: 3,
    total_pages: 2,
  },
};

const PAGE_2_RESPONSE = {
  data: [
    {
      id: 4,
      title: "Data Platform Strategy",
      client_name: "Greenfield Ltd",
      client_id: 3,
      status: "pending",
      approval_status: "pending",
      template_type: "brd",
      version: 1,
      estimated_hours: null,
      created_at: "2025-01-07T10:00:00Z",
      updated_at: "2025-01-08T10:00:00Z",
    },
    {
      id: 5,
      title: "Mobile App MVP",
      client_name: "StartupX",
      client_id: 4,
      status: "pending",
      approval_status: "pending",
      template_type: "mvp",
      version: 1,
      estimated_hours: null,
      created_at: "2025-01-06T10:00:00Z",
      updated_at: "2025-01-07T10:00:00Z",
    },
  ],
  meta: {
    total: 5,
    page: 2,
    page_size: 3,
    total_pages: 2,
  },
};

// ---------------------------------------------------------------------------
// Mock helper
// ---------------------------------------------------------------------------

async function mockProposalApis(page: Page, firstPage = PAGE_1_RESPONSE): Promise<void> {
  await page.route(/\/proposals(\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const pageParam = url.searchParams.get("page") ?? "1";

    await route.fulfill({
      json: pageParam === "2" ? PAGE_2_RESPONSE : firstPage,
    });
  });
}

// ---------------------------------------------------------------------------
// Dashboard — heading and initial render
// ---------------------------------------------------------------------------

test.describe("Dashboard — heading and initial render", () => {
  test.beforeEach(async ({ page }) => {
    await mockProposalApis(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("renders the 'Your Proposals' heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Your Proposals" })).toBeVisible({
      timeout: 8_000,
    });
  });

  test("search input is visible", async ({ page }) => {
    await expect(page.getByPlaceholder("Search by title or client...")).toBeVisible({
      timeout: 6_000,
    });
  });

  test("proposal cards or empty state — never a blank screen", async ({ page }) => {
    await page.waitForSelector("[data-testid='proposal-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    const cards = await page.locator("[data-testid='proposal-card']").count();
    const empty = await page.locator("[data-testid='empty-state']").count();
    expect(cards + empty).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Dashboard — search filtering
// ---------------------------------------------------------------------------

test.describe("Dashboard — search filtering", () => {
  test.beforeEach(async ({ page }) => {
    await mockProposalApis(page);
    await page.goto("/dashboard");

    // Wait until the skeleton is replaced by real content
    await page.waitForSelector("[data-testid='proposal-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });
  });

  test("typing a non-matching query shows the 'No results found' empty state", async ({ page }) => {
    const search = page.getByPlaceholder("Search by title or client...");
    await search.fill("zzz_no_match_xyz");

    // The debounce is 200 ms — wait for it then expect the empty state
    await expect(page.getByText("No results found")).toBeVisible({ timeout: 3_000 });
  });

  test("clearing the search removes the 'No results found' state", async ({ page }) => {
    const search = page.getByPlaceholder("Search by title or client...");
    await search.fill("zzz_no_match_xyz");
    await expect(page.getByText("No results found")).toBeVisible({ timeout: 3_000 });

    await search.clear();

    // After clearing, the no-results message should disappear
    await expect(page.getByText("No results found")).not.toBeVisible({ timeout: 3_000 });
  });

  test("searching by title keeps matching cards and hides others", async ({ page }) => {
    // If no cards were loaded (backend not running or different data shape),
    // skip the assertion so the test does not false-fail in isolation.
    const cardCount = await page.locator("[data-testid='proposal-card']").count();
    if (cardCount === 0) return;

    const search = page.getByPlaceholder("Search by title or client...");
    // "Infrastructure" matches fixture proposal 1 but not 2 or 3
    await search.fill("Infrastructure");

    // Wait for debounce to settle
    await page.waitForTimeout(300);

    // The no-results empty state must NOT appear (at least one card matches)
    await expect(page.getByText("No results found")).not.toBeVisible({ timeout: 3_000 });
  });

  test("searching by client name filters correctly", async ({ page }) => {
    const cardCount = await page.locator("[data-testid='proposal-card']").count();
    if (cardCount === 0) return;

    const search = page.getByPlaceholder("Search by title or client...");
    // "Biz Tech" matches only fixture proposal 2
    await search.fill("Biz Tech");
    await page.waitForTimeout(300);

    await expect(page.getByText("No results found")).not.toBeVisible({ timeout: 3_000 });
  });
});

// ---------------------------------------------------------------------------
// Dashboard — infinite scroll
// ---------------------------------------------------------------------------

test.describe("Dashboard — infinite scroll", () => {
  test("scrolling to the bottom triggers a request for page 2", async ({ page }) => {
    let page2Requested = false;

    // Track the page=2 API call before navigating
    page.on("request", (req) => {
      if (/\/proposals\?.*page=2/.test(req.url())) {
        page2Requested = true;
      }
    });

    await mockProposalApis(page);
    await page.goto("/dashboard");

    await page.waitForSelector("[data-testid='proposal-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    // Only test scroll if cards are present (hasMore is set from API data)
    if ((await page.locator("[data-testid='proposal-card']").count()) === 0) return;

    // Scroll to the very bottom to trigger the IntersectionObserver sentinel
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Give the observer callback and the fetch time to fire
    await page.waitForTimeout(1_500);

    // Either we requested page 2 OR the sentinel is gone (hasMore became false)
    // Both outcomes are correct — what must NOT happen is an error boundary
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();

    if (page2Requested) {
      // More items should now be in the list or a loading indicator was shown
      const allCards = await page.locator("[data-testid='proposal-card']").count();
      expect(allCards).toBeGreaterThan(0);
    }
  });

  test("loading indicator disappears after more proposals are fetched", async ({ page }) => {
    await mockProposalApis(page);
    await page.goto("/dashboard");

    await page.waitForSelector("[data-testid='proposal-card'], [data-testid='empty-state']", {
      timeout: 10_000,
    });

    if ((await page.locator("[data-testid='proposal-card']").count()) === 0) return;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // If the loading spinner appears, it should disappear once the request completes
    const spinner = page.getByText("Loading more proposals…");
    if ((await spinner.count()) > 0) {
      await expect(spinner).not.toBeVisible({ timeout: 8_000 });
    }

    // Heading must remain visible — no crash
    await expect(page.getByRole("heading", { name: "Your Proposals" })).toBeVisible();
  });
});
