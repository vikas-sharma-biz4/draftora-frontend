import {
  generateProposal,
  getProposal,
  getDownloadUrl,
  listProposals,
  regenerateSection,
  updateSection,
  addProposalSection,
  removeProposalSection,
  reorderProposalSections,
  suggestSections,
  parseCustomTemplate,
  parseFiles,
  getSupportedParseFormats,
} from "./proposalApi";
import type { ProposalData } from "@/types/proposal.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, ok = true, status = 200): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

const minimalProposalData: ProposalData = {
  title: "Test Proposal",
  clientName: "Acme Corp",
  description: "A test description",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  selectedSections: ["executive_summary"],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "",
  webReferences: [],
  files: [],
  templateId: null,
  templateType: "scratch",
};

// ---------------------------------------------------------------------------
// handleResponse (tested indirectly through public functions)
// ---------------------------------------------------------------------------

describe("handleResponse — error path", () => {
  it("throws when res.ok is false", async () => {
    mockFetch({ success: false, error: { message: "Not found" } }, false, 404);
    await expect(getProposal(999)).rejects.toThrow("Not found");
  });

  it("throws when success flag is false even with HTTP 200", async () => {
    mockFetch(
      { ok: true, success: false, error: { message: "Logic error" } },
      true,
      200
    );
    await expect(updateSection(1, "intro", "content")).rejects.toThrow(
      "Logic error"
    );
  });

  it("falls back to generic message when no error.message provided", async () => {
    mockFetch({ success: false }, false, 500);
    await expect(updateSection(1, "intro", "x")).rejects.toThrow(
      "Request failed with status 500"
    );
  });
});

// ---------------------------------------------------------------------------
// generateProposal
// ---------------------------------------------------------------------------

describe("generateProposal", () => {
  it("builds FormData and returns id + status on success", async () => {
    mockFetch({ success: true, data: { id: 42, status: "draft" } });
    const result = await generateProposal(minimalProposalData);
    expect(result).toEqual({ id: 42, status: "draft" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/proposals/"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("includes custom section descriptions in contextual_instructions", async () => {
    mockFetch({ success: true, data: { id: 1, status: "draft" } });
    const dataWithCustom: ProposalData = {
      ...minimalProposalData,
      customSections: [
        { key: "custom_1", label: "Custom Section", description: "Details" },
      ],
    };
    await generateProposal(dataWithCustom);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    const formData: FormData = call[1].body;
    const payload = JSON.parse(formData.get("proposal_data") as string);
    expect(payload.contextual_instructions).toContain(
      "[Additional custom sections"
    );
    expect(payload.selected_sections).toContain("custom_1");
  });

  it("merges sectionDisplayNames with custom sections", async () => {
    mockFetch({ success: true, data: { id: 1, status: "draft" } });
    const dataWithDisplay: ProposalData = {
      ...minimalProposalData,
      sectionDisplayNames: { executive_summary: "Exec Summary" },
      customSections: [
        { key: "my_section", label: "My Section", description: "Desc" },
      ],
    };
    await generateProposal(dataWithDisplay);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    const formData: FormData = call[1].body;
    const payload = JSON.parse(formData.get("proposal_data") as string);
    expect(payload.section_display_names).toMatchObject({
      executive_summary: "Exec Summary",
      my_section: "My Section",
    });
  });

  it("throws on API error", async () => {
    mockFetch(
      { success: false, error: { message: "Validation failed" } },
      false,
      422
    );
    await expect(generateProposal(minimalProposalData)).rejects.toThrow(
      "Validation failed"
    );
  });
});

// ---------------------------------------------------------------------------
// getProposal
// ---------------------------------------------------------------------------

describe("getProposal", () => {
  const backendProposal = {
    id: 5,
    title: "My Proposal",
    client_name: "Client X",
    description: "Desc",
    tone: "technical",
    length_preference: "concise",
    language: "English - US",
    selected_sections: ["executive_summary"],
    section_display_names: { executive_summary: "Exec" },
    contextual_instructions: "Some instructions",
    web_references: ["https://example.com"],
    status: "completed",
    sections: { executive_summary: "Content here" },
    generating_section: null,
    mermaid_diagram: "graph TD; A-->B",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  };

  it("maps backend snake_case fields to camelCase ProposalData", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: backendProposal }),
    } as unknown as Response);

    const result = await getProposal(5);
    expect(result.id).toBe(5);
    expect(result.clientName).toBe("Client X");
    expect(result.lengthPreference).toBe("concise");
    expect(result.sectionDisplayNames).toEqual({ executive_summary: "Exec" });
    expect(result.contextualInstructions).toBe("Some instructions");
    expect(result.webReferences).toEqual(["https://example.com"]);
    expect(result.mermaidDiagram).toBe("graph TD; A-->B");
    expect(result.files).toEqual([]);
    expect(result.customSections).toEqual([]);
  });

  it("provides safe defaults for nullable backend fields", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: {
          ...backendProposal,
          description: null,
          selected_sections: null,
          section_display_names: null,
          contextual_instructions: null,
          web_references: null,
          sections: null,
          generating_section: null,
          mermaid_diagram: null,
        },
      }),
    } as unknown as Response);

    const result = await getProposal(5);
    expect(result.description).toBe("");
    expect(result.selectedSections).toEqual([]);
    expect(result.sectionDisplayNames).toEqual({});
    expect(result.contextualInstructions).toBe("");
    expect(result.webReferences).toEqual([]);
    expect(result.sections).toEqual({});
    expect(result.generatingSection).toBeNull();
    expect(result.mermaidDiagram).toBeUndefined();
  });

  it("throws when success is false", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest
        .fn()
        .mockResolvedValue({ success: false, error: { message: "Not found" } }),
    } as unknown as Response);
    await expect(getProposal(999)).rejects.toThrow("Not found");
  });
});

// ---------------------------------------------------------------------------
// updateSection
// ---------------------------------------------------------------------------

describe("updateSection", () => {
  it("sends PUT with correct URL and body", async () => {
    mockFetch({ success: true, data: null });
    await updateSection(1, "executive_summary", "New content");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/proposals/1/sections/executive_summary/"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "New content" }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// regenerateSection
// ---------------------------------------------------------------------------

describe("regenerateSection", () => {
  it("returns content string from response", async () => {
    mockFetch({
      success: true,
      data: { section_key: "intro", content: "Generated text" },
    });
    const result = await regenerateSection(1, "intro");
    expect(result).toBe("Generated text");
  });

  it("sends additional_instructions when provided", async () => {
    mockFetch({
      success: true,
      data: { section_key: "intro", content: "Updated text" },
    });
    await regenerateSection(1, "intro", "Make it shorter");
    const call = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.additional_instructions).toBe("Make it shorter");
  });

  it("sends null additional_instructions when not provided", async () => {
    mockFetch({
      success: true,
      data: { section_key: "intro", content: "Text" },
    });
    await regenerateSection(1, "intro");
    const call = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.additional_instructions).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listProposals
// ---------------------------------------------------------------------------

describe("listProposals", () => {
  it("maps backend array to ProposalListItem list", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 1,
            title: "P1",
            client_name: "Client A",
            status: "completed",
            tone: "professional",
            length_preference: "balanced",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ],
      }),
    } as unknown as Response);

    const items = await listProposals();
    expect(items).toHaveLength(1);
    expect(items[0].clientName).toBe("Client A");
    expect(items[0].lengthPreference).toBe("balanced");
  });

  it("throws on error response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ success: false }),
    } as unknown as Response);
    await expect(listProposals()).rejects.toThrow("Failed to list proposals");
  });
});

// ---------------------------------------------------------------------------
// getDownloadUrl
// ---------------------------------------------------------------------------

describe("getDownloadUrl", () => {
  it("returns a URL containing the proposal id", () => {
    const url = getDownloadUrl(7);
    expect(url).toContain("7");
    expect(url).toContain("/download/");
  });
});

// ---------------------------------------------------------------------------
// addProposalSection / removeProposalSection / reorderProposalSections
// ---------------------------------------------------------------------------

describe("addProposalSection", () => {
  it("sends POST to correct endpoint", async () => {
    mockFetch({ success: true, data: null });
    await addProposalSection(1, {
      section_key: "new_section",
      label: "New Section",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/proposals/1/sections/"),
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("removeProposalSection", () => {
  it("sends DELETE to correct endpoint", async () => {
    mockFetch({ success: true, data: null });
    await removeProposalSection(1, "intro");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/proposals/1/sections/intro/"),
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("reorderProposalSections", () => {
  it("sends PATCH with order payload", async () => {
    mockFetch({ success: true, data: null });
    await reorderProposalSections(1, { order: ["intro", "conclusion"] });
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[1].method).toBe("PATCH");
    const body = JSON.parse(call[1].body as string);
    expect(body.order).toEqual(["intro", "conclusion"]);
  });
});

// ---------------------------------------------------------------------------
// suggestSections
// ---------------------------------------------------------------------------

describe("suggestSections", () => {
  it("returns sections array from response", async () => {
    mockFetch({
      success: true,
      data: {
        sections: [{ key: "intro", label: "Introduction", description: "..." }],
      },
    });
    const sections = await suggestSections({
      title: "AI App",
      description: "An AI app",
      template_type: "scratch",
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("intro");
  });
});

// ---------------------------------------------------------------------------
// parseCustomTemplate
// ---------------------------------------------------------------------------

describe("parseCustomTemplate", () => {
  it("maps response fields to camelCase result", async () => {
    mockFetch({
      success: true,
      data: {
        sections: [
          { key: "scope", label: "Scope", description: "Project scope" },
        ],
        source_type: "docx",
        total_sections: 1,
      },
    });
    const file = new File(["content"], "template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await parseCustomTemplate(file);
    expect(result.sourceType).toBe("docx");
    expect(result.totalSections).toBe(1);
    expect(result.sections[0].label).toBe("Scope");
  });
});

// ---------------------------------------------------------------------------
// parseFiles
// ---------------------------------------------------------------------------

describe("parseFiles", () => {
  it("maps snake_case backend response to camelCase", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        message: "Parsed 1 file",
        files_received: 1,
        files_parsed: 1,
        results: [
          {
            filename: "doc.pdf",
            extension: ".pdf",
            size_bytes: 1024,
            char_count: 500,
            word_count: 80,
            preview: "Preview text...",
            text: "Full text here",
          },
        ],
        errors: [],
      }),
    } as unknown as Response);

    const file = new File(["pdf content"], "doc.pdf", {
      type: "application/pdf",
    });
    const result = await parseFiles([file]);
    expect(result.filesReceived).toBe(1);
    expect(result.filesParsed).toBe(1);
    expect(result.results[0].sizeBytes).toBe(1024);
    expect(result.results[0].charCount).toBe(500);
    expect(result.results[0].wordCount).toBe(80);
    expect(result.errors).toEqual([]);
  });

  it("throws when response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: jest.fn().mockResolvedValue({ detail: "Unprocessable entity" }),
    } as unknown as Response);
    const file = new File(["x"], "bad.exe");
    await expect(parseFiles([file])).rejects.toThrow("Unprocessable entity");
  });
});

// ---------------------------------------------------------------------------
// getSupportedParseFormats
// ---------------------------------------------------------------------------

describe("getSupportedParseFormats", () => {
  it("returns extensions array from response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue({ data: { extensions: [".pdf", ".docx", ".txt"] } }),
    } as unknown as Response);

    const result = await getSupportedParseFormats();
    expect(result).toEqual([".pdf", ".docx", ".txt"]);
  });

  it("returns empty array when extensions missing from response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response);

    const result = await getSupportedParseFormats();
    expect(result).toEqual([]);
  });
});
