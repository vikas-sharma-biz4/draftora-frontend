/**
 * Tests for httpClient handleResponse logic
 *
 * Coverage targets:
 *   - Successful response with data extraction
 *   - API envelope error (success: false)
 *   - HTTP status error (res.ok false)
 *   - Missing error.message fallback
 *   - Full http client methods (get, post, put, patch, delete)
 *   - FormData header handling
 *   - buildUrl utility
 */

import { http, buildUrl } from "@/config/httpClient";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Set env for consistent base URL
process.env.NEXT_PUBLIC_API_URL = "https://api.test.example.com/api/v1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSuccessResponse<T>(data: T): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data }),
  });
}

function mockErrorResponse(
  status: number,
  error?: { code: string; message: string }
): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({
      success: false,
      error,
    }),
  });
}

function mockEnvelopeFailure(message: string): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      success: false,
      error: { code: "VALIDATION_ERROR", message },
    }),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// handleResponse — success path
// ---------------------------------------------------------------------------

describe("httpClient — success responses", () => {
  it("extracts data from successful API envelope", async () => {
    mockSuccessResponse({ id: 1, name: "Test" });

    const result = await http.get<{ id: number; name: string }>("/test/");
    expect(result).toEqual({ id: 1, name: "Test" });
  });

  it("sends GET request with correct URL and headers", async () => {
    mockSuccessResponse([]);

    await http.get("/proposals/");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/proposals/");
    expect(init.method).toBe("GET");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("sends POST request with JSON body", async () => {
    mockSuccessResponse({ id: 1 });

    await http.post("/proposals/", { title: "New" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ title: "New" }));
  });

  it("sends PUT request with JSON body", async () => {
    mockSuccessResponse({ id: 1 });

    await http.put("/proposals/1/", { title: "Updated" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("PUT");
  });

  it("sends PATCH request with JSON body", async () => {
    mockSuccessResponse({ id: 1 });

    await http.patch("/proposals/1/", { title: "Patched" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("PATCH");
  });

  it("sends DELETE request without body", async () => {
    mockSuccessResponse(null);

    await http.delete("/proposals/1/");

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// handleResponse — error paths
// ---------------------------------------------------------------------------

describe("httpClient — error responses", () => {
  it("throws with error.message on HTTP error status", async () => {
    mockErrorResponse(404, {
      code: "NOT_FOUND",
      message: "Proposal not found",
    });

    await expect(http.get("/proposals/999/")).rejects.toThrow(
      "Proposal not found"
    );
  });

  it("throws with status fallback when error.message is missing", async () => {
    mockErrorResponse(500);

    await expect(http.get("/proposals/")).rejects.toThrow(
      "Request failed with status 500"
    );
  });

  it("throws with API failure fallback on envelope success:false with ok:true", async () => {
    mockEnvelopeFailure("Validation failed");

    await expect(http.post("/proposals/", {})).rejects.toThrow(
      "Validation failed"
    );
  });

  it("throws generic message when both ok:true and success:false with no error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false }),
    });

    await expect(http.get("/test/")).rejects.toThrow("API request failed");
  });
});

// ---------------------------------------------------------------------------
// FormData handling
// ---------------------------------------------------------------------------

describe("httpClient — FormData handling", () => {
  it("omits Content-Type header when body is FormData", async () => {
    mockSuccessResponse({ id: 1 });
    const formData = new FormData();
    formData.append("file", new Blob(["content"]), "test.pdf");

    await http.post("/upload/", formData);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBe(formData);
  });
});

// ---------------------------------------------------------------------------
// FetchConfig passthrough
// ---------------------------------------------------------------------------

describe("httpClient — config passthrough", () => {
  it("passes signal, cache, and credentials to fetch", async () => {
    mockSuccessResponse([]);

    const controller = new AbortController();
    await http.get("/proposals/", {
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.signal).toBe(controller.signal);
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("include");
  });

  it("merges custom headers with base headers", async () => {
    mockSuccessResponse([]);

    await http.get("/proposals/", {
      headers: { "X-Custom": "value" },
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-Custom"]).toBe("value");
  });
});

// ---------------------------------------------------------------------------
// buildUrl utility
// ---------------------------------------------------------------------------

describe("buildUrl", () => {
  it("builds full URL from API path", () => {
    expect(buildUrl("/proposals/1/download/")).toContain("/proposals/1/download/");
  });
});
