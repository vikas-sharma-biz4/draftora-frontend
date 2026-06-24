/**
 * Tests for client.service.ts — listClientsFullData
 *
 * Coverage targets:
 *   - Single-page response: returns data without issuing additional fetches
 *   - Multi-page response: remaining pages fetched in parallel after page 1
 *   - Result order preserved across parallel pages
 *   - includeDeleted flag propagated to all page requests
 *   - Error from a parallel page propagates and rejects the call
 *   - snake_case API response correctly transformed to camelCase domain model
 */

import {
  listClientsFullData,
  createClient,
  listClients,
  getClient,
  updateClient,
  deleteClient,
  listClientsWithDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentViewUrl,
  invalidateClientsCache,
} from "@/services/client.service";
import { http } from "@/config/httpClient";
import type { PaginatedApiResponse } from "@/config/httpClient";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    getPaginated: jest.fn(),
  },
  buildUrl: jest.fn((path: string) => `https://api.test.example.com${path}`),
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const mockGet = http.get as jest.Mock;
const mockPost = http.post as jest.Mock;
const mockPatch = http.patch as jest.Mock;
const mockDelete = http.delete as jest.Mock;
const mockGetPaginated = http.getPaginated as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRawClient(id: number) {
  return {
    id,
    name: `Client ${id}`,
    industry: "Technology",
    status: "active" as const,
    notes: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
    documents: [],
  };
}

function makeRawDocument(docId: number, clientId: number) {
  return {
    id: docId,
    client_id: clientId,
    name: `Document ${docId}`,
    file_type: "pdf",
    size_bytes: 1024,
    status: "parsed" as const,
    s3_file_url: "https://s3.example.com/doc.pdf",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

function makePaginatedResponse<T>(
  data: T[],
  totalPages: number,
  page: number = 1
): PaginatedApiResponse<T> {
  return {
    data,
    meta: {
      page,
      per_page: 50,
      total: totalPages * data.length,
      total_pages: totalPages,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Single-page responses
// ---------------------------------------------------------------------------

describe("listClientsFullData — single page", () => {
  it("returns first-page data without additional fetches when total_pages is 1", async () => {
    const rawClients = [makeRawClient(1), makeRawClient(2)];
    mockGetPaginated.mockResolvedValueOnce(makePaginatedResponse(rawClients, 1));

    const result = await listClientsFullData();

    expect(mockGetPaginated).toHaveBeenCalledTimes(1);
    expect(mockGetPaginated).toHaveBeenCalledWith(expect.stringContaining("page=1"));
    expect(result).toHaveLength(2);
  });

  it("transforms snake_case client fields to camelCase", async () => {
    mockGetPaginated.mockResolvedValueOnce(makePaginatedResponse([makeRawClient(1)], 1));

    const [client] = await listClientsFullData();

    expect(client.id).toBe(1);
    expect(client.name).toBe("Client 1");
    expect(client.createdAt).toBe("2025-01-01T00:00:00Z");
    expect(client.updatedAt).toBe("2025-01-02T00:00:00Z");
    expect(client.documents).toEqual([]);
  });

  it("transforms snake_case document fields to camelCase", async () => {
    const rawClientWithDoc = {
      ...makeRawClient(1),
      documents: [makeRawDocument(10, 1)],
    };
    mockGetPaginated.mockResolvedValueOnce(makePaginatedResponse([rawClientWithDoc], 1));

    const [client] = await listClientsFullData();
    const [doc] = client.documents;

    expect(doc.id).toBe(10);
    expect(doc.clientId).toBe(1);
    expect(doc.fileType).toBe("pdf");
    expect(doc.sizeBytes).toBe(1024);
    expect(doc.s3FileUrl).toBe("https://s3.example.com/doc.pdf");
    expect(doc.createdAt).toBe("2025-01-01T00:00:00Z");
  });

  it("returns empty array when API returns no clients", async () => {
    mockGetPaginated.mockResolvedValueOnce(makePaginatedResponse([], 1));

    const result = await listClientsFullData();

    expect(result).toEqual([]);
    expect(mockGetPaginated).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Multi-page parallel fetch
// ---------------------------------------------------------------------------

describe("listClientsFullData — multi-page parallel fetch", () => {
  it("fetches page 1 then remaining pages in parallel", async () => {
    mockGetPaginated
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(1)], 3, 1))
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(2)], 3, 2))
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(3)], 3, 3));

    const result = await listClientsFullData();

    expect(mockGetPaginated).toHaveBeenCalledTimes(3);
    expect(mockGetPaginated).toHaveBeenNthCalledWith(1, expect.stringContaining("page=1"));
    expect(mockGetPaginated).toHaveBeenNthCalledWith(2, expect.stringContaining("page=2"));
    expect(mockGetPaginated).toHaveBeenNthCalledWith(3, expect.stringContaining("page=3"));
    expect(result).toHaveLength(3);
  });

  it("preserves page order in the combined result", async () => {
    const page1 = [makeRawClient(10), makeRawClient(11)];
    const page2 = [makeRawClient(20), makeRawClient(21)];
    const page3 = [makeRawClient(30)];

    mockGetPaginated
      .mockResolvedValueOnce(makePaginatedResponse(page1, 3, 1))
      .mockResolvedValueOnce(makePaginatedResponse(page2, 3, 2))
      .mockResolvedValueOnce(makePaginatedResponse(page3, 3, 3));

    const result = await listClientsFullData();

    expect(result.map((c) => c.id)).toEqual([10, 11, 20, 21, 30]);
  });

  it("handles exactly two pages correctly", async () => {
    mockGetPaginated
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(1)], 2, 1))
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(2)], 2, 2));

    const result = await listClientsFullData();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Query parameter propagation
// ---------------------------------------------------------------------------

describe("listClientsFullData — query parameters", () => {
  it("includes per_page=50 on all requests", async () => {
    mockGetPaginated
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(1)], 2, 1))
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(2)], 2, 2));

    await listClientsFullData();

    const calls = mockGetPaginated.mock.calls as [[string]][];
    expect(calls.every(([path]) => path.includes("per_page=50"))).toBe(true);
  });

  it("appends include_deleted=true to all pages when requested", async () => {
    mockGetPaginated
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(1)], 2, 1))
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(2)], 2, 2));

    await listClientsFullData(true);

    const calls = mockGetPaginated.mock.calls as [[string]][];
    expect(calls.every(([path]) => path.includes("include_deleted=true"))).toBe(true);
  });

  it("does not append include_deleted when flag is false", async () => {
    mockGetPaginated.mockResolvedValueOnce(makePaginatedResponse([makeRawClient(1)], 1));

    await listClientsFullData(false);

    const [path] = mockGetPaginated.mock.calls[0] as [string];
    expect(path).not.toContain("include_deleted");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("listClientsFullData — error handling", () => {
  it("propagates error from page 1 fetch", async () => {
    mockGetPaginated.mockRejectedValueOnce(new Error("Network timeout"));

    await expect(listClientsFullData()).rejects.toThrow("Network timeout");
    expect(mockGetPaginated).toHaveBeenCalledTimes(1);
  });

  it("propagates error from a parallel page fetch", async () => {
    mockGetPaginated
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(1)], 3, 1))
      .mockRejectedValueOnce(new Error("Page 2 failed"))
      .mockResolvedValueOnce(makePaginatedResponse([makeRawClient(3)], 3, 3));

    // Promise.all rejects as soon as any promise rejects
    await expect(listClientsFullData()).rejects.toThrow("Page 2 failed");
  });
});

// ---------------------------------------------------------------------------
// createClient
// ---------------------------------------------------------------------------

describe("createClient", () => {
  it("posts to /clients and returns id and name", async () => {
    mockPost.mockResolvedValue({ id: 10, name: "New Client" });
    const result = await createClient({ name: "New Client", industry: "Tech", notes: null });
    expect(mockPost).toHaveBeenCalledWith("/clients", {
      name: "New Client",
      industry: "Tech",
      notes: null,
    });
    expect(result).toEqual({ id: 10, name: "New Client" });
  });
});

// ---------------------------------------------------------------------------
// listClients
// ---------------------------------------------------------------------------

describe("listClients", () => {
  it("gets /clients and transforms snake_case to camelCase", async () => {
    mockGet.mockResolvedValue([makeRawClient(1)]);
    const result = await listClients();
    expect(mockGet).toHaveBeenCalledWith("/clients");
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe("2025-01-01T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// getClient
// ---------------------------------------------------------------------------

describe("getClient", () => {
  it("gets /clients/:id and returns client with documents", async () => {
    const rawWithDocs = { ...makeRawClient(1), documents: [makeRawDocument(10, 1)] };
    mockGet.mockResolvedValue(rawWithDocs);
    const result = await getClient(1);
    expect(result.id).toBe(1);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].fileType).toBe("pdf");
  });
});

// ---------------------------------------------------------------------------
// updateClient
// ---------------------------------------------------------------------------

describe("updateClient", () => {
  it("patches /clients/:id and returns updated client", async () => {
    mockPatch.mockResolvedValue({ ...makeRawClient(1), name: "Updated Name" });
    const result = await updateClient(1, { name: "Updated Name" });
    expect(mockPatch).toHaveBeenCalledWith("/clients/1", { name: "Updated Name" });
    expect(result.name).toBe("Updated Name");
  });
});

// ---------------------------------------------------------------------------
// deleteClient
// ---------------------------------------------------------------------------

describe("deleteClient", () => {
  it("sends DELETE request to /clients/:id", async () => {
    mockDelete.mockResolvedValue(null);
    await deleteClient(1);
    expect(mockDelete).toHaveBeenCalledWith("/clients/1");
  });
});

// ---------------------------------------------------------------------------
// listClientsWithDocuments (deprecated)
// ---------------------------------------------------------------------------

describe("listClientsWithDocuments", () => {
  it("delegates to listClientsFullData (single page)", async () => {
    mockGetPaginated.mockResolvedValueOnce(makePaginatedResponse([makeRawClient(1)], 1));
    const result = await listClientsWithDocuments();
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// invalidateClientsCache (no-op)
// ---------------------------------------------------------------------------

describe("invalidateClientsCache", () => {
  it("is a no-op and does not throw", () => {
    expect(() => invalidateClientsCache()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

describe("uploadDocument", () => {
  it("posts FormData to /clients/:id/documents and returns document", async () => {
    const rawDoc = makeRawDocument(5, 1);
    mockPost.mockResolvedValue(rawDoc);
    const file = new File(["content"], "report.pdf", { type: "application/pdf" });
    const result = await uploadDocument(1, file);
    expect(mockPost).toHaveBeenCalledWith("/clients/1/documents", expect.any(FormData));
    expect(result.id).toBe(5);
    expect(result.fileType).toBe("pdf");
  });
});

// ---------------------------------------------------------------------------
// deleteDocument
// ---------------------------------------------------------------------------

describe("deleteDocument", () => {
  it("sends DELETE to /clients/:id/documents/:docId", async () => {
    mockDelete.mockResolvedValue(null);
    await deleteDocument(1, 10);
    expect(mockDelete).toHaveBeenCalledWith("/clients/1/documents/10");
  });
});

// ---------------------------------------------------------------------------
// getDocumentViewUrl
// ---------------------------------------------------------------------------

describe("getDocumentViewUrl", () => {
  it("gets view URL from the API", async () => {
    mockGet.mockResolvedValue({
      view_url: "https://s3.amazonaws.com/signed-url",
      expires_in: 3600,
    });
    const result = await getDocumentViewUrl(1, 10);
    expect(result).toBe("https://s3.amazonaws.com/signed-url");
  });
});
