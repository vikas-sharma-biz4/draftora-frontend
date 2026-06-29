/**
 * Tests for src/utils/exportPdf.ts
 *
 * Uses virtual mocks for html2canvas and jspdf (packages may not be installed).
 *
 * Coverage targets:
 *   - exportElementAsPdf: happy path — single-page PDF
 *   - exportElementAsPdf: multi-page content (while loop addPage branch)
 *   - exportElementAsPdf: filename sanitization (replace unsafe chars)
 *   - exportElementAsPdf: empty filename falls back to "artifact"
 *   - exportElementAsPdf: error thrown → logger.error → re-throw
 */

// ---------------------------------------------------------------------------
// Virtual mocks (packages not installed)
// ---------------------------------------------------------------------------

const mockSave = jest.fn();
const mockAddImage = jest.fn();
const mockAddPage = jest.fn();
const mockGetWidth = jest.fn().mockReturnValue(210);
const mockGetHeight = jest.fn().mockReturnValue(297);
const MockJsPDFInstance = {
  internal: { pageSize: { getWidth: mockGetWidth, getHeight: mockGetHeight } },
  addImage: mockAddImage,
  addPage: mockAddPage,
  save: mockSave,
};
const MockJsPDF = jest.fn().mockImplementation(() => MockJsPDFInstance);

jest.mock(
  "jspdf",
  () => ({
    __esModule: true,
    // Must be a regular function (not arrow) so it can be called with `new`
    // Returning an object from a constructor overrides the `this` binding
    default: function MockJsPDFCtor() {
      return MockJsPDFInstance;
    },
  }),
  { virtual: true }
);

const mockToDataURL = jest.fn().mockReturnValue("data:image/png;base64,fake");
const mockHtml2canvas = jest.fn();

jest.mock(
  "html2canvas",
  () => ({ __esModule: true, default: (...args: unknown[]) => mockHtml2canvas(...args) }),
  { virtual: true }
);

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { exportElementAsPdf } from "@/utils/exportPdf";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(scrollHeight = 600): HTMLElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
  return el;
}

function makeCanvas(width = 1200, height = 800): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "width", { value: width, configurable: true });
  Object.defineProperty(canvas, "height", { value: height, configurable: true });
  canvas.toDataURL = mockToDataURL;
  return canvas;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetWidth.mockReturnValue(210);
  mockGetHeight.mockReturnValue(297);
  MockJsPDF.mockImplementation(() => MockJsPDFInstance);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("exportElementAsPdf — single-page content", () => {
  it("calls html2canvas, creates jsPDF, and saves the file", async () => {
    mockHtml2canvas.mockResolvedValue(makeCanvas(1200, 800));

    await exportElementAsPdf(makeElement(), "My Report");

    expect(mockHtml2canvas).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ scale: 2, useCORS: true })
    );
    expect(mockAddImage).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith("My Report.pdf");
    expect(mockAddPage).not.toHaveBeenCalled();
  });
});

describe("exportElementAsPdf — multi-page content", () => {
  it("calls addPage when scaled content height exceeds one A4 page", async () => {
    // ratio = 210/1200 = 0.175; scaledHeight = 3000*0.175 = 525 > pdfHeight (297) → needs 2 pages
    mockHtml2canvas.mockResolvedValue(makeCanvas(1200, 3000));

    await exportElementAsPdf(makeElement(1500), "Long Report");

    expect(mockAddPage).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith("Long Report.pdf");
  });
});

describe("exportElementAsPdf — filename sanitization", () => {
  it("replaces unsafe characters in filename", async () => {
    mockHtml2canvas.mockResolvedValue(makeCanvas());

    await exportElementAsPdf(makeElement(), "Report: 2024/01");

    const filename: string = mockSave.mock.calls[0][0];
    expect(filename).not.toContain(":");
    expect(filename).not.toContain("/");
    expect(filename).toMatch(/\.pdf$/);
  });

  it("falls back to 'artifact' when filename is empty after sanitization", async () => {
    mockHtml2canvas.mockResolvedValue(makeCanvas());

    // Chars replaced → all "_" → trim() → still has chars (not empty) — test actual empty case
    // Filename with only whitespace after trim → empty string → "artifact"
    await exportElementAsPdf(makeElement(), "   ");

    expect(mockSave).toHaveBeenCalledWith("artifact.pdf");
  });
});

describe("exportElementAsPdf — error handling", () => {
  it("logs error and re-throws when html2canvas fails", async () => {
    const { logger } = jest.requireMock("@/utils/logger") as { logger: { error: jest.Mock } };
    mockHtml2canvas.mockRejectedValue(new Error("canvas failed"));

    await expect(exportElementAsPdf(makeElement(), "report")).rejects.toThrow("canvas failed");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[exportPdf]"),
      expect.any(Error)
    );
  });

  it("logs error and re-throws when canvas toDataURL fails", async () => {
    const { logger } = jest.requireMock("@/utils/logger") as { logger: { error: jest.Mock } };
    const badCanvas = makeCanvas();
    badCanvas.toDataURL = () => {
      throw new Error("toDataURL failed");
    };
    mockHtml2canvas.mockResolvedValue(badCanvas);

    await expect(exportElementAsPdf(makeElement(), "report")).rejects.toThrow("toDataURL failed");
    expect(logger.error).toHaveBeenCalled();
  });
});
