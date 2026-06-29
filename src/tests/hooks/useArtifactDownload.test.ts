/**
 * Tests for useArtifactDownload hook
 *
 * Coverage targets:
 *   - defaultFilename branch for DOCX: fallbackTitle provided → "{title}.docx"
 *   - defaultFilename branch for DOCX: no fallbackTitle → "artifact-{id}.docx"
 *   - defaultFilename branch for PDF: fallbackTitle provided → "{title}.pdf"
 *   - defaultFilename branch for PDF: no fallbackTitle → "artifact-{id}.pdf"
 *   - hook returns isDownloading and isPdfDownloading from useFileDownload
 */

import { renderHook } from "@testing-library/react";
import { useArtifactDownload } from "@/hooks/useArtifactDownload";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/artifact.service", () => ({
  getArtifactDownloadUrl: jest.fn(
    (id: number) => `https://api/artifacts/${id}/download?format=docx`
  ),
  getArtifactPdfUrl: jest.fn((id: number) => `https://api/artifacts/${id}/download?format=pdf`),
}));

jest.mock("@/constants/messages", () => ({
  MESSAGES: {
    ARTIFACT_DOWNLOADED: "Downloaded successfully",
    ARTIFACT_DOWNLOAD_FAILED: "Download failed",
  },
}));

// Capture the useFileDownload options so we can exercise defaultFilename branches
const capturedOptions: Array<{ defaultFilename: (id: number, title?: string) => string }> = [];

jest.mock("@/hooks/useFileDownload", () => ({
  useFileDownload: jest.fn(
    (opts: {
      defaultFilename: (id: number, title?: string) => string;
      isDownloading?: boolean;
    }) => {
      capturedOptions.push(opts);
      return {
        isDownloading: false,
        download: jest.fn(),
      };
    }
  ),
}));

import { useFileDownload } from "@/hooks/useFileDownload";
const mockUseFileDownload = useFileDownload as jest.Mock;

beforeEach(() => {
  capturedOptions.length = 0;
  jest.clearAllMocks();
  mockUseFileDownload.mockImplementation(
    (opts: { defaultFilename: (id: number, title?: string) => string }) => {
      capturedOptions.push(opts);
      return { isDownloading: false, download: jest.fn() };
    }
  );
});

// ---------------------------------------------------------------------------
// defaultFilename branches — DOCX
// ---------------------------------------------------------------------------

describe("useArtifactDownload — DOCX defaultFilename", () => {
  it("returns '{fallbackTitle}.docx' when fallbackTitle is provided", () => {
    renderHook(() => useArtifactDownload());
    const docxOpts = capturedOptions[0];
    expect(docxOpts.defaultFilename(1, "My Invoice")).toBe("My Invoice.docx");
  });

  it("returns 'artifact-{id}.docx' when fallbackTitle is undefined", () => {
    renderHook(() => useArtifactDownload());
    const docxOpts = capturedOptions[0];
    expect(docxOpts.defaultFilename(42, undefined)).toBe("artifact-42.docx");
  });

  it("returns 'artifact-{id}.docx' when fallbackTitle is empty string (falsy)", () => {
    renderHook(() => useArtifactDownload());
    const docxOpts = capturedOptions[0];
    expect(docxOpts.defaultFilename(7, "")).toBe("artifact-7.docx");
  });
});

// ---------------------------------------------------------------------------
// defaultFilename branches — PDF
// ---------------------------------------------------------------------------

describe("useArtifactDownload — PDF defaultFilename", () => {
  it("returns '{fallbackTitle}.pdf' when fallbackTitle is provided", () => {
    renderHook(() => useArtifactDownload());
    const pdfOpts = capturedOptions[1];
    expect(pdfOpts.defaultFilename(1, "My Invoice")).toBe("My Invoice.pdf");
  });

  it("returns 'artifact-{id}.pdf' when fallbackTitle is undefined", () => {
    renderHook(() => useArtifactDownload());
    const pdfOpts = capturedOptions[1];
    expect(pdfOpts.defaultFilename(99, undefined)).toBe("artifact-99.pdf");
  });

  it("returns 'artifact-{id}.pdf' when fallbackTitle is empty string (falsy)", () => {
    renderHook(() => useArtifactDownload());
    const pdfOpts = capturedOptions[1];
    expect(pdfOpts.defaultFilename(3, "")).toBe("artifact-3.pdf");
  });
});

// ---------------------------------------------------------------------------
// Return value shape
// ---------------------------------------------------------------------------

describe("useArtifactDownload — return shape", () => {
  it("exposes isDownloading and isPdfDownloading flags", () => {
    const { result } = renderHook(() => useArtifactDownload());
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.isPdfDownloading).toBe(false);
  });

  it("exposes downloadArtifact and downloadArtifactPdf functions", () => {
    const { result } = renderHook(() => useArtifactDownload());
    expect(typeof result.current.downloadArtifact).toBe("function");
    expect(typeof result.current.downloadArtifactPdf).toBe("function");
  });
});
