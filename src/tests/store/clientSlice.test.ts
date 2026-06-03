/**
 * Tests for clientSlice Zustand store
 *
 * Coverage targets:
 *   - isCacheValid: uninitialized, within TTL, expired
 *   - getClientById: found and not found
 *   - fetchClients: cache-hit skip, concurrent-guard skip, success, error
 *   - addDocument: client found (appends), client not found (mock client created)
 *   - removeDocument, updateDocument
 *   - createClient, updateClientApi
 *   - deleteClient: success, 404 (still removes), non-404 rethrows
 *   - uploadDocument: success (merges file size), 404 returns undefined, other error rethrows
 *   - deleteDocument: optimistic remove is immediate; API error is swallowed (H3 regression guard)
 *   - invalidateCache, reset, setClients, addClient, updateClient, removeClient
 */

import { useClientStore, INITIAL_CLIENT_STATE } from "@/store/features/clients/clientSlice";
import * as clientApi from "@/services/client.service";
import { HttpError } from "@/config/httpClient";
import type { ClientWithDocuments, ClientDocument } from "@/services/client.service";

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
      this.name = "HttpError";
      this.statusCode = statusCode;
    }
  },
}));

jest.mock("@/services/client.service", () => ({
  listClientsFullData: jest.fn(),
  createClient: jest.fn(),
  getClient: jest.fn(),
  updateClient: jest.fn(),
  deleteClient: jest.fn(),
  uploadDocument: jest.fn(),
  deleteDocument: jest.fn(),
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// persist middleware writes to localStorage — mock it globally
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true });

const mockListClientsFullData = clientApi.listClientsFullData as jest.Mock;
const mockCreateClient = clientApi.createClient as jest.Mock;
const mockGetClient = clientApi.getClient as jest.Mock;
const mockUpdateClient = clientApi.updateClient as jest.Mock;
const mockDeleteClient = clientApi.deleteClient as jest.Mock;
const mockUploadDocument = clientApi.uploadDocument as jest.Mock;
const mockDeleteDocument = clientApi.deleteDocument as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDoc(id: number, clientId: number): ClientDocument {
  return {
    id,
    clientId,
    name: `doc-${id}.pdf`,
    fileType: "pdf",
    sizeBytes: 1024,
    status: "parsed",
    s3FileUrl: `https://s3.example.com/doc-${id}.pdf`,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

function makeClient(id: number, docs: ClientDocument[] = []): ClientWithDocuments {
  return {
    id,
    name: `Client ${id}`,
    industry: "Technology",
    status: "active",
    notes: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    documents: docs,
  };
}

function makeHttpError(statusCode: number, message: string): HttpError {
  return new HttpError(statusCode, message);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  useClientStore.setState({ ...INITIAL_CLIENT_STATE });
});

// ---------------------------------------------------------------------------
// isCacheValid
// ---------------------------------------------------------------------------

describe("clientSlice — isCacheValid", () => {
  it("returns false when not initialized", () => {
    useClientStore.setState({ isInitialized: false, lastFetched: null });
    expect(useClientStore.getState().isCacheValid()).toBe(false);
  });

  it("returns false when lastFetched is null", () => {
    useClientStore.setState({ isInitialized: true, lastFetched: null });
    expect(useClientStore.getState().isCacheValid()).toBe(false);
  });

  it("returns true when lastFetched is within TTL", () => {
    useClientStore.setState({ isInitialized: true, lastFetched: Date.now() - 1000 });
    expect(useClientStore.getState().isCacheValid()).toBe(true);
  });

  it("returns false when lastFetched is beyond TTL (5 minutes)", () => {
    const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
    useClientStore.setState({ isInitialized: true, lastFetched: sixMinutesAgo });
    expect(useClientStore.getState().isCacheValid()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getClientById
// ---------------------------------------------------------------------------

describe("clientSlice — getClientById", () => {
  it("returns the client when it exists", () => {
    const client = makeClient(1);
    useClientStore.setState({ clients: [client] });
    expect(useClientStore.getState().getClientById(1)).toEqual(client);
  });

  it("returns undefined when the client does not exist", () => {
    useClientStore.setState({ clients: [] });
    expect(useClientStore.getState().getClientById(99)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fetchClients
// ---------------------------------------------------------------------------

describe("clientSlice — fetchClients", () => {
  it("skips fetch when cache is valid and force is false", async () => {
    useClientStore.setState({ isInitialized: true, lastFetched: Date.now() });
    await useClientStore.getState().fetchClients(false);
    expect(mockListClientsFullData).not.toHaveBeenCalled();
  });

  it("skips fetch when isLoading is true (concurrent guard)", async () => {
    useClientStore.setState({ isLoading: true });
    await useClientStore.getState().fetchClients(true);
    expect(mockListClientsFullData).not.toHaveBeenCalled();
  });

  it("forces fetch even when cache is valid when force=true", async () => {
    const clients = [makeClient(1)];
    mockListClientsFullData.mockResolvedValueOnce(clients);
    useClientStore.setState({ isInitialized: true, lastFetched: Date.now() });

    await useClientStore.getState().fetchClients(true);

    expect(mockListClientsFullData).toHaveBeenCalledTimes(1);
    expect(useClientStore.getState().clients).toEqual(clients);
  });

  it("sets clients, isInitialized, and lastFetched on success", async () => {
    const clients = [makeClient(1), makeClient(2)];
    mockListClientsFullData.mockResolvedValueOnce(clients);

    await useClientStore.getState().fetchClients();

    const state = useClientStore.getState();
    expect(state.clients).toEqual(clients);
    expect(state.isInitialized).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.total).toBe(2);
    expect(state.lastFetched).not.toBeNull();
  });

  it("sets error state and rethrows on API failure", async () => {
    mockListClientsFullData.mockRejectedValueOnce(new Error("Network error"));

    await expect(useClientStore.getState().fetchClients()).rejects.toThrow("Network error");

    const state = useClientStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("Network error");
  });
});

// ---------------------------------------------------------------------------
// setClients / addClient / updateClient / removeClient
// ---------------------------------------------------------------------------

describe("clientSlice — basic CRUD actions", () => {
  it("setClients replaces the list and marks initialized", () => {
    const clients = [makeClient(1), makeClient(2)];
    useClientStore.getState().setClients(clients);
    const state = useClientStore.getState();
    expect(state.clients).toEqual(clients);
    expect(state.isInitialized).toBe(true);
    expect(state.total).toBe(2);
  });

  it("addClient appends and increments total", () => {
    useClientStore.setState({ clients: [makeClient(1)], total: 1 });
    useClientStore.getState().addClient(makeClient(2));
    expect(useClientStore.getState().clients).toHaveLength(2);
    expect(useClientStore.getState().total).toBe(2);
  });

  it("updateClient patches matching client fields", () => {
    useClientStore.setState({ clients: [makeClient(1)] });
    useClientStore.getState().updateClient(1, { name: "Renamed" });
    expect(useClientStore.getState().clients[0].name).toBe("Renamed");
  });

  it("removeClient removes by id and decrements total", () => {
    useClientStore.setState({ clients: [makeClient(1), makeClient(2)], total: 2 });
    useClientStore.getState().removeClient(1);
    const state = useClientStore.getState();
    expect(state.clients).toHaveLength(1);
    expect(state.clients[0].id).toBe(2);
    expect(state.total).toBe(1);
  });

  it("invalidateCache clears lastFetched and isInitialized", () => {
    useClientStore.setState({ lastFetched: Date.now(), isInitialized: true });
    useClientStore.getState().invalidateCache();
    expect(useClientStore.getState().lastFetched).toBeNull();
    expect(useClientStore.getState().isInitialized).toBe(false);
  });

  it("reset returns to initial state", () => {
    useClientStore.setState({ clients: [makeClient(1)], total: 1, isInitialized: true });
    useClientStore.getState().reset();
    expect(useClientStore.getState().clients).toEqual([]);
    expect(useClientStore.getState().total).toBe(0);
    expect(useClientStore.getState().isInitialized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addDocument
// ---------------------------------------------------------------------------

describe("clientSlice — addDocument", () => {
  it("appends document to an existing client", () => {
    const client = makeClient(1, [makeDoc(10, 1)]);
    useClientStore.setState({ clients: [client] });

    useClientStore.getState().addDocument(1, makeDoc(11, 1));

    const updated = useClientStore.getState().clients.find((c) => c.id === 1);
    expect(updated?.documents).toHaveLength(2);
    expect(updated?.documents[1].id).toBe(11);
  });

  it("creates a mock client when the clientId is not in the store", () => {
    useClientStore.setState({ clients: [] });

    useClientStore.getState().addDocument(99, makeDoc(1, 99));

    const state = useClientStore.getState();
    expect(state.clients).toHaveLength(1);
    expect(state.clients[0].id).toBe(99);
    expect(state.clients[0].industry).toBe("Unknown");
    expect(state.clients[0].documents).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// removeDocument / updateDocument
// ---------------------------------------------------------------------------

describe("clientSlice — removeDocument / updateDocument", () => {
  it("removeDocument filters out the matching document", () => {
    const client = makeClient(1, [makeDoc(10, 1), makeDoc(11, 1)]);
    useClientStore.setState({ clients: [client] });

    useClientStore.getState().removeDocument(1, 10);

    const updated = useClientStore.getState().clients.find((c) => c.id === 1);
    expect(updated?.documents).toHaveLength(1);
    expect(updated?.documents[0].id).toBe(11);
  });

  it("updateDocument patches the matching document fields", () => {
    const client = makeClient(1, [makeDoc(10, 1)]);
    useClientStore.setState({ clients: [client] });

    useClientStore.getState().updateDocument(1, 10, { status: "processing" });

    const updated = useClientStore.getState().clients.find((c) => c.id === 1);
    expect(updated?.documents[0].status).toBe("processing");
  });
});

// ---------------------------------------------------------------------------
// createClient / updateClientApi
// ---------------------------------------------------------------------------

describe("clientSlice — createClient / updateClientApi", () => {
  it("createClient calls API and adds full client to store", async () => {
    mockCreateClient.mockResolvedValueOnce({ id: 5, name: "New Client" });
    mockGetClient.mockResolvedValueOnce(makeClient(5));

    const result = await useClientStore.getState().createClient({
      name: "New Client",
      industry: "Finance",
    });

    expect(result).toEqual({ id: 5, name: "New Client" });
    expect(useClientStore.getState().clients.find((c) => c.id === 5)).toBeDefined();
  });

  it("updateClientApi patches client in store after API call", async () => {
    useClientStore.setState({ clients: [makeClient(1)] });
    mockUpdateClient.mockResolvedValueOnce({ ...makeClient(1), name: "Updated" });

    await useClientStore.getState().updateClientApi(1, { name: "Updated" });

    expect(useClientStore.getState().clients.find((c) => c.id === 1)?.name).toBe("Updated");
  });
});

// ---------------------------------------------------------------------------
// deleteClient
// ---------------------------------------------------------------------------

describe("clientSlice — deleteClient", () => {
  it("removes client from store on success", async () => {
    useClientStore.setState({ clients: [makeClient(1), makeClient(2)], total: 2 });
    mockDeleteClient.mockResolvedValueOnce(undefined);

    await useClientStore.getState().deleteClient(1);

    expect(useClientStore.getState().clients.find((c) => c.id === 1)).toBeUndefined();
  });

  it("still removes client on 404 (soft-delete aware)", async () => {
    useClientStore.setState({ clients: [makeClient(1)], total: 1 });
    mockDeleteClient.mockRejectedValueOnce(makeHttpError(404, "Not Found"));

    await useClientStore.getState().deleteClient(1);

    expect(useClientStore.getState().clients).toHaveLength(0);
  });

  it("rethrows on non-404 API errors", async () => {
    useClientStore.setState({ clients: [makeClient(1)], total: 1 });
    mockDeleteClient.mockRejectedValueOnce(makeHttpError(500, "Server Error"));

    await expect(useClientStore.getState().deleteClient(1)).rejects.toThrow("Server Error");
  });
});

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

describe("clientSlice — uploadDocument", () => {
  it("uploads document and adds it to the client in store", async () => {
    useClientStore.setState({ clients: [makeClient(1)] });
    const uploaded = makeDoc(20, 1);
    mockUploadDocument.mockResolvedValueOnce(uploaded);

    const result = await useClientStore
      .getState()
      .uploadDocument(1, new File(["content"], "test.pdf", { type: "application/pdf" }));

    expect(result).toBeDefined();
    expect(result?.id).toBe(20);
    const client = useClientStore.getState().clients.find((c) => c.id === 1);
    expect(client?.documents.find((d) => d.id === 20)).toBeDefined();
  });

  it("returns undefined on 404 without throwing (client deleted mid-upload)", async () => {
    mockUploadDocument.mockRejectedValueOnce(makeHttpError(404, "Client Not Found"));

    const result = await useClientStore
      .getState()
      .uploadDocument(99, new File(["content"], "test.pdf"));

    expect(result).toBeUndefined();
  });

  it("rethrows on non-404 API errors", async () => {
    mockUploadDocument.mockRejectedValueOnce(new Error("Upload failed"));

    await expect(
      useClientStore.getState().uploadDocument(1, new File(["content"], "test.pdf"))
    ).rejects.toThrow("Upload failed");
  });

  it("uses file.size as fallback when API returns sizeBytes of 0", async () => {
    useClientStore.setState({ clients: [makeClient(1)] });
    const apiDoc = { ...makeDoc(20, 1), sizeBytes: 0 };
    mockUploadDocument.mockResolvedValueOnce(apiDoc);

    const file = new File(["x".repeat(4096)], "big.pdf");
    const result = await useClientStore.getState().uploadDocument(1, file);

    expect(result?.sizeBytes).toBe(file.size);
  });
});

// ---------------------------------------------------------------------------
// deleteDocument — optimistic remove with rollback on failure (H3 fixed)
// ---------------------------------------------------------------------------

describe("clientSlice — deleteDocument", () => {
  it("removes document from store immediately (optimistic update)", async () => {
    const client = makeClient(1, [makeDoc(10, 1), makeDoc(11, 1)]);
    useClientStore.setState({ clients: [client] });

    let resolveDelete!: () => void;
    mockDeleteDocument.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );

    const promise = useClientStore.getState().deleteDocument(1, 10);

    // Document is already gone even though API hasn't resolved yet
    const updated = useClientStore.getState().clients.find((c) => c.id === 1);
    expect(updated?.documents.find((d) => d.id === 10)).toBeUndefined();

    // Settle the pending API call to avoid test leak
    resolveDelete();
    await promise;
  });

  it("restores document to store and rethrows on API failure (H3 rollback)", async () => {
    const client = makeClient(1, [makeDoc(10, 1)]);
    useClientStore.setState({ clients: [client] });

    mockDeleteDocument.mockRejectedValueOnce(new Error("Delete failed"));

    await expect(useClientStore.getState().deleteDocument(1, 10)).rejects.toThrow("Delete failed");

    // Document is restored after rollback
    const updated = useClientStore.getState().clients.find((c) => c.id === 1);
    expect(updated?.documents).toHaveLength(1);
    expect(updated?.documents[0].id).toBe(10);
  });
});
