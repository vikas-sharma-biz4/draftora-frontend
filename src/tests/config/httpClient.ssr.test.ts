/**
 * @jest-environment node
 *
 * SSR deduplication bypass tests for httpClient.
 *
 * This file uses the Node test environment (not jsdom) so that
 * `typeof window === "undefined"` is naturally true — exactly as it
 * would be on a Next.js server render. jsdom marks `window` as
 * non-configurable, making it impossible to simulate SSR from within
 * a jsdom test without hacking the environment.
 *
 * Coverage targets:
 *   - Concurrent GET requests to the same path return DIFFERENT promise instances
 *   - Two independent network calls are issued (no shared deduplication map)
 */

import { http } from "@/config/httpClient";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

process.env.NEXT_PUBLIC_API_URL = "https://api.test.example.com/api/v1";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSuccessResponse<T>(data: T): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: async () => JSON.stringify({ success: true, data }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("httpClient — SSR deduplication bypass (@jest-environment node)", () => {
  it("issues two independent network calls for the same path (no shared promise)", async () => {
    mockSuccessResponse([1]);
    mockSuccessResponse([2]);

    const [r1, r2] = await Promise.all([
      http.get<number[]>("/proposals/"),
      http.get<number[]>("/proposals/"),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(r1).toEqual([1]);
    expect(r2).toEqual([2]);
  });

  it("returns different promise instances for the same path on the server", () => {
    mockFetch
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ success: true, data: [] }),
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ success: true, data: [] }),
        })
      );

    const p1 = http.get<number[]>("/proposals/");
    const p2 = http.get<number[]>("/proposals/");

    // Each call must get its own Promise — deduplication must not apply on the server
    expect(p1).not.toBe(p2);

    return Promise.all([p1, p2]);
  });
});
