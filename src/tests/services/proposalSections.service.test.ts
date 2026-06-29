/**
 * Tests for proposalSections.service.ts
 *
 * Coverage targets:
 *   - updateSection: PUT path + body
 *   - regenerateSection: POST path + returns content string
 *   - regenerateSelection: POST path + response field mapping
 *   - addProposalSection: POST + format_type → formatType mapping
 *   - removeProposalSection: DELETE path
 *   - reorderProposalSections: PATCH path + sectionDisplayNames → section_display_names mapping
 */

import {
  updateSection,
  regenerateSection,
  regenerateSelection,
  addProposalSection,
  removeProposalSection,
  reorderProposalSections,
} from "@/services/proposal/proposalSections.service";
import { http } from "@/config/httpClient";

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
  },
  buildUrl: jest.fn(),
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockHttpGet = http.get as jest.Mock;
const mockHttpPost = http.post as jest.Mock;
const mockHttpPut = http.put as jest.Mock;
const mockHttpPatch = http.patch as jest.Mock;
const mockHttpDelete = http.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// updateSection
// ---------------------------------------------------------------------------

describe("proposalSections.service — updateSection", () => {
  it("calls http.put targeting the correct proposal/section path", async () => {
    mockHttpPut.mockResolvedValue(undefined);
    await updateSection(42, "executive_summary", "New content here");

    expect(mockHttpPut).toHaveBeenCalledTimes(1);
    const [path] = mockHttpPut.mock.calls[0];
    expect(path).toMatch(/\/proposals\/42.*executive_summary/);
  });

  it("sends the content in the request body", async () => {
    mockHttpPut.mockResolvedValue(undefined);
    await updateSection(42, "executive_summary", "Hello world");

    const [, body] = mockHttpPut.mock.calls[0];
    expect(body).toMatchObject({ content: "Hello world" });
  });

  it("resolves without a return value", async () => {
    mockHttpPut.mockResolvedValue(null);
    const result = await updateSection(1, "scope", "text");
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// regenerateSection
// ---------------------------------------------------------------------------

describe("proposalSections.service — regenerateSection", () => {
  it("calls http.post targeting the regenerate endpoint for the proposal", async () => {
    mockHttpPost.mockResolvedValue({ content: "Regenerated text" });
    await regenerateSection(10, "timeline");

    const [path] = mockHttpPost.mock.calls[0];
    expect(path).toMatch(/\/proposals\/10.*regenerate/);
  });

  it("includes the sectionKey in the request body", async () => {
    mockHttpPost.mockResolvedValue({ content: "text" });
    await regenerateSection(10, "timeline");

    const [, body] = mockHttpPost.mock.calls[0];
    expect(body).toMatchObject({ section_key: "timeline" });
  });

  it("includes optional instructions when provided", async () => {
    mockHttpPost.mockResolvedValue({ content: "text" });
    await regenerateSection(10, "timeline", "Make it shorter");

    const [, body] = mockHttpPost.mock.calls[0];
    // The service uses additional_instructions (not instructions)
    expect(body).toMatchObject({ additional_instructions: "Make it shorter" });
  });

  it("returns the content string from the API response", async () => {
    mockHttpPost.mockResolvedValue({ content: "Regenerated section content" });
    const result = await regenerateSection(5, "executive_summary");
    expect(result).toBe("Regenerated section content");
  });
});

// ---------------------------------------------------------------------------
// regenerateSelection
// ---------------------------------------------------------------------------

describe("proposalSections.service — regenerateSelection", () => {
  it("calls http.post targeting the regenerate-selection endpoint", async () => {
    mockHttpPost.mockResolvedValue({ regenerated_text: "Better text", format: "paragraph" });
    await regenerateSelection(7, "scope", "selected words");

    const [path] = mockHttpPost.mock.calls[0];
    expect(path).toMatch(/\/proposals\/7.*regenerate-selection/);
  });

  it("maps regenerated_text and format from the response", async () => {
    mockHttpPost.mockResolvedValue({ regenerated_text: "Improved", format: "bullets" });
    const result = await regenerateSelection(7, "scope", "selected words");

    expect(result).toMatchObject({ regeneratedText: "Improved", format: "bullets" });
  });

  it("passes selectionContext and instructions when provided (truthy ?? branches)", async () => {
    mockHttpPost.mockResolvedValue({ regenerated_text: "Result", format: "paragraph" });
    await regenerateSelection(7, "scope", "text", "surrounding context", "be concise");

    const body = mockHttpPost.mock.calls[0][1];
    expect(body.selection_context).toBe("surrounding context");
    expect(body.instructions).toBe("be concise");
  });

  it("returns format=null when response has no format field (null ?? branch)", async () => {
    mockHttpPost.mockResolvedValue({ regenerated_text: "No format" });
    const result = await regenerateSelection(7, "scope", "text");
    expect(result.format).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// addProposalSection
// ---------------------------------------------------------------------------

describe("proposalSections.service — addProposalSection", () => {
  it("calls http.post with the section payload", async () => {
    mockHttpPost.mockResolvedValue({
      key: "custom_section",
      label: "Custom",
      content: "",
      format_type: "paragraph",
    });

    await addProposalSection(3, { key: "custom_section", label: "Custom", description: "" });

    expect(mockHttpPost).toHaveBeenCalledTimes(1);
    const [path] = mockHttpPost.mock.calls[0];
    expect(path).toMatch(/\/proposals\/3/);
  });

  it("maps format_type (snake_case) to formatType (camelCase) in the result", async () => {
    mockHttpPost.mockResolvedValue({
      key: "custom_section",
      label: "Custom",
      content: "initial content",
      format_type: "table",
    });

    const result = await addProposalSection(3, {
      key: "custom_section",
      label: "Custom",
      description: "",
    });

    expect(result).toMatchObject({
      key: "custom_section",
      label: "Custom",
      content: "initial content",
      formatType: "table",
    });
  });
});

// ---------------------------------------------------------------------------
// removeProposalSection
// ---------------------------------------------------------------------------

describe("proposalSections.service — removeProposalSection", () => {
  it("calls http.delete targeting the correct proposal/section path", async () => {
    mockHttpDelete.mockResolvedValue(undefined);
    await removeProposalSection(15, "appendix");

    expect(mockHttpDelete).toHaveBeenCalledTimes(1);
    const [path] = mockHttpDelete.mock.calls[0];
    expect(path).toMatch(/\/proposals\/15.*appendix/);
  });

  it("resolves without a return value", async () => {
    mockHttpDelete.mockResolvedValue(null);
    const result = await removeProposalSection(1, "scope");
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// reorderProposalSections
// ---------------------------------------------------------------------------

describe("proposalSections.service — reorderProposalSections", () => {
  it("calls http.patch targeting the reorder endpoint", async () => {
    mockHttpPatch.mockResolvedValue(undefined);
    await reorderProposalSections(20, {
      sectionOrder: ["scope", "timeline"],
      sectionDisplayNames: { scope: "Scope" },
    });

    expect(mockHttpPatch).toHaveBeenCalledTimes(1);
    const [path] = mockHttpPatch.mock.calls[0];
    expect(path).toMatch(/\/proposals\/20.*reorder/);
  });

  it("maps sectionDisplayNames to section_display_names in the body", async () => {
    mockHttpPatch.mockResolvedValue(undefined);
    await reorderProposalSections(20, {
      sectionOrder: ["a", "b"],
      sectionDisplayNames: { a: "Section A", b: "Section B" },
    });

    const [, body] = mockHttpPatch.mock.calls[0];
    expect(body).toMatchObject({
      section_display_names: { a: "Section A", b: "Section B" },
    });
  });
});
