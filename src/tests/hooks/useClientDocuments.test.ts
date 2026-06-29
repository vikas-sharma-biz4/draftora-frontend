/**
 * Tests for useClientDocuments.ts
 *
 * Coverage targets:
 *   - filteredDocuments: empty query returns all; substring match is case-insensitive
 *   - handleDeleteDocument: sets deleteDocModalData
 *   - confirmDeleteDocument: calls store deleteDocument action; error shows toast
 *   - confirmDeleteAllDocuments: optimistic remove; partial-failure toast with count
 *   - handleViewDocument: opens window for valid https URL; specific toasts for 400/404/generic errors
 *   - handleDeleteAllDocuments: skips when no documents
 */

import { renderHook, act } from "@testing-library/react";

import { useClientDocuments } from "@/hooks/useClientDocuments";
import type { ClientWithDocuments, ClientDocument } from "@/interfaces/clientInterfaces";

// ---------------------------------------------------------------------------
// Mocks — store
// ---------------------------------------------------------------------------

const mockUploadDocument = jest.fn();
const mockRemoveDocument = jest.fn();
const mockDeleteDocument = jest.fn();

jest.mock("@/store/features/clients/clientSlice", () => ({
  useClientStore: (selector: (s: unknown) => unknown) => {
    const state = {
      uploadDocument: mockUploadDocument,
      removeDocument: mockRemoveDocument,
      deleteDocument: mockDeleteDocument,
    };
    return selector(state);
  },
}));

// ---------------------------------------------------------------------------
// Mocks — client service
// ---------------------------------------------------------------------------

const mockGetDocumentViewUrl = jest.fn();
const mockDeleteClientDocument = jest.fn();

jest.mock("@/services/client.service", () => ({
  getDocumentViewUrl: (...args: unknown[]) => mockGetDocumentViewUrl(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteClientDocument(...args),
}));

// ---------------------------------------------------------------------------
// Mocks — toast / logger
// ---------------------------------------------------------------------------

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock("@/utils/toast", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDocument = (id: number, name: string, s3Url?: string): ClientDocument => ({
  id,
  name,
  s3FileUrl: s3Url ?? `https://s3.example.com/${name}`,
  status: "parsed",
  createdAt: "2025-01-01T00:00:00Z",
});

const makeClient = (docs: ClientDocument[]): ClientWithDocuments => ({
  id: 1,
  name: "Test Client",
  status: "active",
  documents: docs,
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Mock window.open (jsdom doesn't implement it)
const mockWindowOpen = jest.fn();
Object.defineProperty(window, "open", { value: mockWindowOpen, writable: true });

// Helper: create a fake FileList (DataTransfer may not be available in all jsdom versions)
function makeFakeFileList(...files: File[]): FileList {
  return Object.assign(files, {
    item: (index: number): File | null => files[index] ?? null,
  }) as unknown as FileList;
}

class MockHttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteDocument.mockResolvedValue(undefined);
  mockDeleteClientDocument.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// filteredDocuments
// ---------------------------------------------------------------------------

describe("useClientDocuments — filteredDocuments", () => {
  it("returns all documents when searchQuery is empty", () => {
    const client = makeClient([makeDocument(1, "contract.pdf"), makeDocument(2, "proposal.docx")]);

    const { result } = renderHook(() => useClientDocuments(client));
    expect(result.current.filteredDocuments).toHaveLength(2);
  });

  it("filters documents by name substring (case-insensitive)", () => {
    const client = makeClient([makeDocument(1, "Contract.pdf"), makeDocument(2, "proposal.docx")]);

    const { result } = renderHook(() => useClientDocuments(client));

    act(() => {
      result.current.setSearchQuery("contract");
    });

    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].id).toBe(1);
  });

  it("returns empty array when query matches nothing", () => {
    const client = makeClient([makeDocument(1, "report.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    act(() => {
      result.current.setSearchQuery("zzz_no_match");
    });

    expect(result.current.filteredDocuments).toHaveLength(0);
  });

  it("returns empty array when client is undefined", () => {
    const { result } = renderHook(() => useClientDocuments(undefined));
    expect(result.current.filteredDocuments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// handleDeleteDocument / confirmDeleteDocument
// ---------------------------------------------------------------------------

describe("useClientDocuments — handleDeleteDocument", () => {
  it("sets deleteDocModalData with the correct id and name", () => {
    const client = makeClient([makeDocument(10, "invoice.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    act(() => {
      result.current.handleDeleteDocument(10, "invoice.pdf");
    });

    expect(result.current.deleteDocModalData).toEqual({ id: 10, name: "invoice.pdf" });
  });
});

describe("useClientDocuments — confirmDeleteDocument", () => {
  it("calls the store deleteDocument action with the correct clientId and docId", async () => {
    const client = makeClient([makeDocument(10, "invoice.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    act(() => {
      result.current.handleDeleteDocument(10, "invoice.pdf");
    });

    await act(async () => {
      await result.current.confirmDeleteDocument();
    });

    expect(mockDeleteDocument).toHaveBeenCalledWith(1, 10);
  });

  it("shows an error toast when the store deleteDocument throws", async () => {
    mockDeleteDocument.mockRejectedValue(new Error("Delete failed"));
    const client = makeClient([makeDocument(10, "invoice.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    act(() => {
      result.current.handleDeleteDocument(10, "invoice.pdf");
    });

    await act(async () => {
      await result.current.confirmDeleteDocument();
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError.mock.calls[0][0]).toMatch(/delete|restore/i);
  });

  it("does nothing when deleteDocModalData is null", async () => {
    const client = makeClient([makeDocument(10, "invoice.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    // Do NOT call handleDeleteDocument first
    await act(async () => {
      await result.current.confirmDeleteDocument();
    });

    expect(mockDeleteDocument).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// confirmDeleteAllDocuments
// ---------------------------------------------------------------------------

describe("useClientDocuments — confirmDeleteAllDocuments", () => {
  it("calls removeDocumentFromStore for every document optimistically", async () => {
    const docs = [makeDocument(1, "a.pdf"), makeDocument(2, "b.pdf")];
    const client = makeClient(docs);
    const { result } = renderHook(() => useClientDocuments(client));

    act(() => {
      result.current.setDeleteAllDocsModalOpen(true);
    });

    await act(async () => {
      await result.current.confirmDeleteAllDocuments();
    });

    expect(mockRemoveDocument).toHaveBeenCalledTimes(2);
    expect(mockRemoveDocument).toHaveBeenCalledWith(1, 1);
    expect(mockRemoveDocument).toHaveBeenCalledWith(1, 2);
  });

  it("shows a failure-count toast when some API calls are rejected", async () => {
    const docs = [makeDocument(1, "a.pdf"), makeDocument(2, "b.pdf"), makeDocument(3, "c.pdf")];
    const client = makeClient(docs);

    // First call succeeds, last two fail
    mockDeleteClientDocument
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.confirmDeleteAllDocuments();
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError.mock.calls[0][0]).toMatch(/2 document/i);
  });

  it("shows a singular error message when exactly one document fails", async () => {
    const docs = [makeDocument(1, "a.pdf"), makeDocument(2, "b.pdf")];
    const client = makeClient(docs);

    mockDeleteClientDocument
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.confirmDeleteAllDocuments();
    });

    const errorMsg: string = mockToastError.mock.calls[0][0];
    // Should NOT say "documents" (plural) for a single failure
    expect(errorMsg).toMatch(/1 document[^s]/);
  });

  it("shows no error toast when all deletes succeed", async () => {
    const docs = [makeDocument(1, "a.pdf"), makeDocument(2, "b.pdf")];
    const client = makeClient(docs);
    mockDeleteClientDocument.mockResolvedValue(undefined);

    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.confirmDeleteAllDocuments();
    });

    expect(mockToastError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleViewDocument
// ---------------------------------------------------------------------------

describe("useClientDocuments — handleViewDocument", () => {
  it("opens the in-app modal viewer for a valid https:// URL", async () => {
    mockGetDocumentViewUrl.mockResolvedValue("https://s3.example.com/file.pdf");
    const client = makeClient([makeDocument(5, "file.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleViewDocument(client.documents[0]);
    });

    expect(result.current.viewingDocModal).toEqual(
      expect.objectContaining({
        url: "https://s3.example.com/file.pdf",
        fileName: "file.pdf",
      })
    );
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("shows an error toast (no open) when the URL is not https://", async () => {
    mockGetDocumentViewUrl.mockResolvedValue("http://insecure.example.com/file.pdf");
    const client = makeClient([makeDocument(5, "file.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleViewDocument(client.documents[0]);
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it("shows a 400-specific toast when the API returns HTTP 400", async () => {
    mockGetDocumentViewUrl.mockRejectedValue(new MockHttpError(400, "Bad Request"));
    const client = makeClient([makeDocument(5, "file.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleViewDocument(client.documents[0]);
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError.mock.calls[0][0]).toMatch(/no stored file|S3/i);
  });

  it("shows a 404-specific toast when the API returns HTTP 404", async () => {
    mockGetDocumentViewUrl.mockRejectedValue(new MockHttpError(404, "Not Found"));
    const client = makeClient([makeDocument(5, "file.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleViewDocument(client.documents[0]);
    });

    expect(mockToastError.mock.calls[0][0]).toMatch(/not found/i);
  });

  it("shows a generic error toast for all other API errors", async () => {
    mockGetDocumentViewUrl.mockRejectedValue(new MockHttpError(500, "Server Error"));
    const client = makeClient([makeDocument(5, "file.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleViewDocument(client.documents[0]);
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError.mock.calls[0][0]).toMatch(/could not open|try again/i);
  });
});

// ---------------------------------------------------------------------------
// handleDeleteAllDocuments guard
// ---------------------------------------------------------------------------

describe("useClientDocuments — handleDeleteAllDocuments", () => {
  it("does not open the modal when the client has no documents", () => {
    const client = makeClient([]);
    const { result } = renderHook(() => useClientDocuments(client));

    act(() => {
      result.current.handleDeleteAllDocuments();
    });

    expect(result.current.deleteAllDocsModalOpen).toBe(false);
  });

  it("opens the modal when the client has at least one document", () => {
    const client = makeClient([makeDocument(1, "doc.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    act(() => {
      result.current.handleDeleteAllDocuments();
    });

    expect(result.current.deleteAllDocsModalOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// closeDocViewer
// ---------------------------------------------------------------------------

describe("useClientDocuments — closeDocViewer", () => {
  it("clears viewingDocModal", async () => {
    mockGetDocumentViewUrl.mockResolvedValue("https://s3.example.com/file.pdf");
    const client = makeClient([makeDocument(5, "file.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleViewDocument(client.documents[0]);
    });
    expect(result.current.viewingDocModal).not.toBeNull();

    act(() => {
      result.current.closeDocViewer();
    });
    expect(result.current.viewingDocModal).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// handleDownloadDocument
// ---------------------------------------------------------------------------

describe("useClientDocuments — handleDownloadDocument", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Mock anchor click
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows error toast when doc has no s3FileUrl", async () => {
    const docNoS3: ClientDocument = {
      id: 7,
      name: "legacy.pdf",
      s3FileUrl: undefined as unknown as string,
      status: "parsed",
      createdAt: "2025-01-01T00:00:00Z",
    };
    const client = makeClient([docNoS3]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleDownloadDocument(docNoS3);
    });

    expect(mockToastError).toHaveBeenCalledWith("No file available for download.");
  });

  it("shows error toast when URL is not https://", async () => {
    mockGetDocumentViewUrl.mockResolvedValue("http://insecure.example.com/file.pdf");
    const client = makeClient([makeDocument(8, "file.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleDownloadDocument(client.documents[0]);
    });

    expect(mockToastError).toHaveBeenCalledWith("Could not download document. Please try again.");
  });

  it("shows error toast when getDocumentViewUrl throws", async () => {
    mockGetDocumentViewUrl.mockRejectedValue(new Error("Network error"));
    const client = makeClient([makeDocument(9, "doc.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleDownloadDocument(client.documents[0]);
    });

    expect(mockToastError).toHaveBeenCalledWith("Could not download document. Please try again.");
  });

  it("triggers download for a valid https:// URL", async () => {
    mockGetDocumentViewUrl.mockResolvedValue("https://s3.example.com/doc.pdf");
    const appendSpy = jest.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    const removeSpy = jest.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    const client = makeClient([makeDocument(10, "doc.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleDownloadDocument(client.documents[0]);
    });

    expect(appendSpy).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(removeSpy).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("does nothing when client is undefined", async () => {
    const { result } = renderHook(() => useClientDocuments(undefined));
    const doc: ClientDocument = {
      id: 11,
      name: "doc.pdf",
      s3FileUrl: "https://s3.example.com/doc.pdf",
      status: "parsed",
      createdAt: "2025-01-01T00:00:00Z",
    };

    await act(async () => {
      await result.current.handleDownloadDocument(doc);
    });

    expect(mockGetDocumentViewUrl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleFileInputChange / handleFileUpload
// ---------------------------------------------------------------------------

describe("useClientDocuments — handleFileInputChange", () => {
  it("uploads files when files are provided", async () => {
    mockUploadDocument.mockResolvedValue({ id: 1, name: "test.pdf" });
    const client = makeClient([]);
    const { result } = renderHook(() => useClientDocuments(client));

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const fakeFiles = makeFakeFileList(file);
    const fakeEvent = {
      target: { files: fakeFiles, value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      result.current.handleFileInputChange(fakeEvent);
      // wait for async upload
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockUploadDocument).toHaveBeenCalledWith(1, file);
  });

  it("shows error toast when uploadDocument returns undefined", async () => {
    mockUploadDocument.mockResolvedValue(undefined);
    const client = makeClient([]);
    const { result } = renderHook(() => useClientDocuments(client));

    const file = new File(["content"], "fail.pdf", { type: "application/pdf" });
    const fakeEvent = {
      target: { files: makeFakeFileList(file), value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      result.current.handleFileInputChange(fakeEvent);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("fail.pdf"));
  });

  it("shows error toast when upload throws", async () => {
    mockUploadDocument.mockRejectedValue(new Error("Upload failed"));
    const client = makeClient([]);
    const { result } = renderHook(() => useClientDocuments(client));

    const file = new File(["content"], "bad.pdf", { type: "application/pdf" });
    const fakeEvent = {
      target: { files: makeFakeFileList(file), value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      result.current.handleFileInputChange(fakeEvent);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("bad.pdf"));
  });

  it("does nothing when files is null", async () => {
    const client = makeClient([]);
    const { result } = renderHook(() => useClientDocuments(client));

    const fakeEvent = {
      target: { files: null, value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      result.current.handleFileInputChange(fakeEvent);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockUploadDocument).not.toHaveBeenCalled();
  });

  it("does nothing when client is undefined", async () => {
    const { result } = renderHook(() => useClientDocuments(undefined));
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const fakeEvent = {
      target: { files: makeFakeFileList(file), value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      result.current.handleFileInputChange(fakeEvent);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockUploadDocument).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleRestoreToS3Click
// ---------------------------------------------------------------------------

describe("useClientDocuments — handleRestoreToS3Click", () => {
  it("stops propagation and sets restoringDocId", () => {
    const client = makeClient([makeDocument(3, "doc.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    const mockStop = jest.fn();
    const fakeEvent = { stopPropagation: mockStop } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleRestoreToS3Click(3, fakeEvent);
    });

    expect(mockStop).toHaveBeenCalled();
    expect(result.current.restoringDocId).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// handleRestoreFileInputChange
// ---------------------------------------------------------------------------

describe("useClientDocuments — handleRestoreFileInputChange", () => {
  it("does nothing when file is missing", async () => {
    const client = makeClient([makeDocument(5, "doc.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    const fakeEvent = {
      target: { files: null, value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleRestoreFileInputChange(fakeEvent);
    });

    expect(mockRestoreDocumentToS3).not.toHaveBeenCalled();
  });

  it("restores document to S3 and shows success toast", async () => {
    mockRestoreDocumentToS3.mockResolvedValue({ s3FileUrl: "https://s3.example.com/restored.pdf" });
    const client = makeClient([makeDocument(5, "doc.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    // Set restoringDocId first
    const mockStop = jest.fn();
    act(() => {
      result.current.handleRestoreToS3Click(5, {
        stopPropagation: mockStop,
      } as unknown as React.MouseEvent);
    });

    const file = new File(["content"], "restore.pdf", { type: "application/pdf" });
    const fakeEvent = {
      target: { files: makeFakeFileList(file), value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleRestoreFileInputChange(fakeEvent);
    });

    expect(mockRestoreDocumentToS3).toHaveBeenCalledWith(1, 5, file);
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("S3"));
  });

  it("shows error toast when restore fails", async () => {
    mockRestoreDocumentToS3.mockRejectedValue(new Error("S3 error"));
    const client = makeClient([makeDocument(5, "doc.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    const mockStop = jest.fn();
    act(() => {
      result.current.handleRestoreToS3Click(5, {
        stopPropagation: mockStop,
      } as unknown as React.MouseEvent);
    });

    const file = new File(["content"], "restore.pdf", { type: "application/pdf" });
    const fakeEvent = {
      target: { files: makeFakeFileList(file), value: "" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleRestoreFileInputChange(fakeEvent);
    });

    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("S3"));
  });
});

// ---------------------------------------------------------------------------
// handleMigrateAllToS3
// ---------------------------------------------------------------------------

describe("useClientDocuments — handleMigrateAllToS3", () => {
  it("shows success toast when all documents already have S3 URLs", async () => {
    const client = makeClient([makeDocument(1, "a.pdf"), makeDocument(2, "b.pdf")]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleMigrateAllToS3();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("All documents already have S3 URLs.");
    expect(mockMigrateDocumentsToS3).not.toHaveBeenCalled();
  });

  it("migrates and shows success toast when all succeed", async () => {
    mockMigrateDocumentsToS3.mockResolvedValue({
      migrated: 2,
      failed: 0,
      skipped: 0,
      results: [
        { id: 1, s3FileUrl: "https://s3.example.com/a.pdf" },
        { id: 2, s3FileUrl: "https://s3.example.com/b.pdf" },
      ],
    });

    const docNoS3a: ClientDocument = {
      id: 1,
      name: "a.pdf",
      s3FileUrl: undefined as unknown as string,
      status: "parsed",
      createdAt: "",
    };
    const docNoS3b: ClientDocument = {
      id: 2,
      name: "b.pdf",
      s3FileUrl: undefined as unknown as string,
      status: "parsed",
      createdAt: "",
    };
    const client = makeClient([docNoS3a, docNoS3b]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleMigrateAllToS3();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("migrated to S3"));
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("shows error toast when some migrations fail", async () => {
    mockMigrateDocumentsToS3.mockResolvedValue({
      migrated: 1,
      failed: 1,
      skipped: 0,
      results: [
        { id: 1, s3FileUrl: "https://s3.example.com/a.pdf" },
        { id: 2, s3FileUrl: undefined },
      ],
    });

    const docNoS3a: ClientDocument = {
      id: 1,
      name: "a.pdf",
      s3FileUrl: undefined as unknown as string,
      status: "parsed",
      createdAt: "",
    };
    const docNoS3b: ClientDocument = {
      id: 2,
      name: "b.pdf",
      s3FileUrl: undefined as unknown as string,
      status: "parsed",
      createdAt: "",
    };
    const client = makeClient([docNoS3a, docNoS3b]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleMigrateAllToS3();
    });

    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("failed"));
  });

  it("shows error toast when migrateDocumentsToS3 throws", async () => {
    mockMigrateDocumentsToS3.mockRejectedValue(new Error("S3 migration error"));

    const docNoS3: ClientDocument = {
      id: 1,
      name: "a.pdf",
      s3FileUrl: undefined as unknown as string,
      status: "parsed",
      createdAt: "",
    };
    const client = makeClient([docNoS3]);
    const { result } = renderHook(() => useClientDocuments(client));

    await act(async () => {
      await result.current.handleMigrateAllToS3();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Migration failed. Check your S3 configuration and try again."
    );
  });

  it("does nothing when client is undefined", async () => {
    const { result } = renderHook(() => useClientDocuments(undefined));

    await act(async () => {
      await result.current.handleMigrateAllToS3();
    });

    expect(mockMigrateDocumentsToS3).not.toHaveBeenCalled();
  });
});
