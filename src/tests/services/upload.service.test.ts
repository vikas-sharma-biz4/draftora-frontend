/**
 * Tests for src/services/upload.service.ts
 */

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock http for getSupportedFormats
jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
  },
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import { parseFiles, getSupportedFormats } from "@/services/upload.service";
import { http } from "@/config/httpClient";

const mockHttp = http as { get: jest.Mock };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockGlobalFetch(body: unknown, ok = true, status = 200): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
});

// ---------------------------------------------------------------------------
// parseFiles
// ---------------------------------------------------------------------------

describe("parseFiles — success", () => {
  const mockResponse = {
    success: true,
    message: "Parsed successfully",
    files_received: 1,
    files_parsed: 1,
    results: [
      {
        filename: "test.pdf",
        extension: "pdf",
        size_bytes: 1024,
        char_count: 500,
        word_count: 100,
        preview: "Hello",
        text: "Hello World",
      },
    ],
    errors: [],
  };

  it("calls the parse endpoint with FormData", async () => {
    mockGlobalFetch(mockResponse);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await parseFiles([file]);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/parse/"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns the parsed response", async () => {
    mockGlobalFetch(mockResponse);
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const result = await parseFiles([file]);

    expect(result.success).toBe(true);
    expect(result.files_received).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].filename).toBe("test.pdf");
  });

  it("sends all provided files", async () => {
    mockGlobalFetch({ ...mockResponse, files_received: 2, results: [] });
    const files = [new File(["a"], "a.pdf"), new File(["b"], "b.docx")];
    await parseFiles(files);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const body: FormData = fetchCall[1].body;
    expect(body.getAll("files")).toHaveLength(2);
  });
});

describe("parseFiles — failure", () => {
  it("throws when response is not ok", async () => {
    mockGlobalFetch({}, false, 500);
    const file = new File(["x"], "x.pdf");
    await expect(parseFiles([file])).rejects.toThrow("Parse request failed with status 500");
  });
});

// ---------------------------------------------------------------------------
// getSupportedFormats
// ---------------------------------------------------------------------------

describe("getSupportedFormats", () => {
  it("calls http.get for supported formats", async () => {
    mockHttp.get.mockResolvedValue({ extensions: [".pdf", ".docx"], max_size_mb: 10 });
    const result = await getSupportedFormats();
    expect(mockHttp.get).toHaveBeenCalledWith("/parse/supported-formats/");
    expect(result.extensions).toEqual([".pdf", ".docx"]);
    expect(result.max_size_mb).toBe(10);
  });

  it("propagates errors from http.get", async () => {
    mockHttp.get.mockRejectedValue(new Error("Network error"));
    await expect(getSupportedFormats()).rejects.toThrow("Network error");
  });
});
