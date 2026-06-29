/**
 * Tests for src/services/proposal/proposalCrud.service.ts
 *
 * Covers: parseToneOption, parseLengthOption, parseTemplateType,
 * generateProposal, getProposalStatus, getProposal, listProposals,
 * listProposalHistory, cancelProposal, updateApprovalStatus, estimateProposalHours
 */

jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
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

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/config/config", () => ({
  DEFAULT_AI_MODEL: "gpt-4o",
}));

import {
  generateProposal,
  getProposalStatus,
  getProposal,
  listProposals,
  listProposalHistory,
  getDownloadUrl,
  cancelProposal,
  updateApprovalStatus,
  estimateProposalHours,
} from "@/services/proposal/proposalCrud.service";
import { http, HttpError } from "@/config/httpClient";
import { logger } from "@/utils/logger";

const mockGet = http.get as jest.Mock;
const mockPost = http.post as jest.Mock;
const mockPatch = http.patch as jest.Mock;
const mockLogger = logger as { warn: jest.Mock; info: jest.Mock };

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseRawProposal = {
  id: 1,
  title: "Test Proposal",
  client_name: "Acme Corp",
  client_id: 5,
  description: "Proposal description",
  tone: "professional",
  length_preference: "balanced",
  language: "English - US",
  ai_model: "gpt-4o",
  selected_sections: ["executive_summary", "timeline"],
  section_display_names: null,
  contextual_instructions: null,
  web_references: null,
  selected_document_ids: null,
  template_type: "scratch",
  status: "completed",
  approval_status: "pending" as const,
  sections: null,
  section_types: null,
  generating_section: null,
  estimated_hours_data: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
};

const baseWizardData = {
  title: "Test Proposal",
  clientName: "Acme Corp",
  clientId: 5,
  description: "A proposal",
  tone: "professional" as const,
  lengthPreference: "balanced" as const,
  language: "English - US",
  aiModel: "gpt-4o",
  selectedSections: ["executive_summary"],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "",
  webReferences: [],
  selectedDocumentIds: [],
  templateId: null,
  templateType: "scratch" as const,
  filesMeta: [],
  approvalStatus: "pending" as const,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// parseToneOption — via generateProposal + getProposal
// ---------------------------------------------------------------------------

describe("proposalCrud — parseToneOption", () => {
  it("accepts valid tone values", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, tone: "technical" });
    const result = await getProposal(1);
    expect(result.tone).toBe("technical");
  });

  it("defaults to 'professional' for unknown tone and logs warning", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, tone: "unknown_tone" });
    const result = await getProposal(1);
    expect(result.tone).toBe("professional");
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Unknown ToneOption"));
  });
});

// ---------------------------------------------------------------------------
// parseLengthOption — via getProposal
// ---------------------------------------------------------------------------

describe("proposalCrud — parseLengthOption", () => {
  it("accepts valid length values like 'comprehensive'", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, length_preference: "comprehensive" });
    const result = await getProposal(1);
    expect(result.lengthPreference).toBe("comprehensive");
  });

  it("defaults to 'balanced' for unknown length and logs warning", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, length_preference: "unknown_length" });
    const result = await getProposal(1);
    expect(result.lengthPreference).toBe("balanced");
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Unknown LengthOption"));
  });
});

// ---------------------------------------------------------------------------
// parseTemplateType — via getProposal
// ---------------------------------------------------------------------------

describe("proposalCrud — parseTemplateType", () => {
  it("accepts valid template types like 'predefined'", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, template_type: "predefined" });
    const result = await getProposal(1);
    expect(result.templateType).toBe("predefined");
  });

  it("defaults to 'scratch' for null template_type", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, template_type: null });
    const result = await getProposal(1);
    expect(result.templateType).toBe("scratch");
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("defaults to 'scratch' for unknown template type", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, template_type: "invalid_type" });
    const result = await getProposal(1);
    expect(result.templateType).toBe("scratch");
  });
});

// ---------------------------------------------------------------------------
// mapProposal — field mapping
// ---------------------------------------------------------------------------

describe("proposalCrud — mapProposal", () => {
  it("maps snake_case fields to camelCase", async () => {
    mockGet.mockResolvedValue(baseRawProposal);
    const result = await getProposal(1);
    expect(result.id).toBe(1);
    expect(result.clientName).toBe("Acme Corp");
    expect(result.clientId).toBe(5);
    expect(result.createdAt).toBe("2025-01-01T00:00:00Z");
    expect(result.updatedAt).toBe("2025-01-02T00:00:00Z");
  });

  it("provides empty defaults for null fields", async () => {
    mockGet.mockResolvedValue({
      ...baseRawProposal,
      description: null,
      sections: null,
      section_types: null,
      web_references: null,
      selected_document_ids: null,
      generating_section: null,
    });
    const result = await getProposal(1);
    expect(result.description).toBe("");
    expect(result.sections).toEqual({});
    expect(result.sectionTypes).toEqual({});
    expect(result.webReferences).toEqual([]);
    expect(result.selectedDocumentIds).toEqual([]);
    expect(result.generatingSection).toBeNull();
  });

  it("includes estimatedHoursData when present", async () => {
    const estimatedHoursData = {
      total_estimated_hours: { hours: 100, description: "Total" },
      team_breakdown: [{ role: "Dev", hours: 80, description: "Dev work" }],
      feature_list_used: "feature list",
      custom_prompt_used: null,
    };
    mockGet.mockResolvedValue({ ...baseRawProposal, estimated_hours_data: estimatedHoursData });
    const result = await getProposal(1);
    expect(result.estimatedHoursData).toBeDefined();
    expect(result.estimatedHoursData?.totalEstimatedHours.hours).toBe(100);
    expect(result.estimatedHoursData?.customPromptUsed).toBeUndefined();
  });

  it("sets estimatedHoursData to undefined when absent", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, estimated_hours_data: null });
    const result = await getProposal(1);
    expect(result.estimatedHoursData).toBeUndefined();
  });

  it("uses DEFAULT_AI_MODEL when ai_model is null", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, ai_model: null });
    const result = await getProposal(1);
    expect(result.aiModel).toBe("gpt-4o");
  });

  it("defaults approvalStatus to 'pending' when null", async () => {
    mockGet.mockResolvedValue({ ...baseRawProposal, approval_status: null });
    const result = await getProposal(1);
    expect(result.approvalStatus).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// getProposal — runtime shape validation
// ---------------------------------------------------------------------------

describe("getProposal — shape validation", () => {
  it("throws HttpError(502) when API response is missing a required field", async () => {
    // Simulate an API contract violation: 'status' field is absent
    const { status: _status, ...incomplete } = baseRawProposal;
    mockGet.mockResolvedValue(incomplete);
    await expect(getProposal(1)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("throws HttpError(502) when API response is null", async () => {
    mockGet.mockResolvedValue(null);
    await expect(getProposal(1)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("succeeds and maps correctly when all required fields are present", async () => {
    mockGet.mockResolvedValue(baseRawProposal);
    const result = await getProposal(1);
    expect(result.id).toBe(1);
    expect(result.title).toBe("Test Proposal");
  });
});

// ---------------------------------------------------------------------------
// generateProposal
// ---------------------------------------------------------------------------

describe("generateProposal", () => {
  it("posts to /proposals and returns response", async () => {
    mockPost.mockResolvedValue({ id: 42, status: "generating", jobId: "job-1" });
    const result = await generateProposal(baseWizardData);
    expect(mockPost).toHaveBeenCalledWith("/proposals", expect.any(FormData));
    expect(result.id).toBe(42);
    expect(result.status).toBe("generating");
  });

  it("throws for unsupported file extension", async () => {
    const wizardData = {
      ...baseWizardData,
      files: [new File(["content"], "doc.exe", { type: "application/octet-stream" })],
    };
    await expect(generateProposal(wizardData)).rejects.toThrow("Unsupported file type");
  });

  it("throws when file exceeds max size", async () => {
    const largeFile = new File(["x".repeat(10)], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(largeFile, "size", { value: 51 * 1024 * 1024 });
    const wizardData = { ...baseWizardData, files: [largeFile] };
    await expect(generateProposal(wizardData)).rejects.toThrow("File too large");
  });

  it("appends custom sections to contextual instructions", async () => {
    mockPost.mockResolvedValue({ id: 1, status: "ok" });
    const wizardData = {
      ...baseWizardData,
      customSections: [
        { key: "custom_sec", label: "Custom Section", description: "A custom section" },
      ],
    };
    await generateProposal(wizardData);
    const formData: FormData = mockPost.mock.calls[0][1];
    const proposalDataStr = formData.get("proposal_data") as string;
    const proposalDataObj = JSON.parse(proposalDataStr);
    expect(proposalDataObj.contextual_instructions).toContain("Custom Section");
  });

  it("includes valid file in FormData", async () => {
    mockPost.mockResolvedValue({ id: 5, status: "generating" });
    const validFile = new File(["content"], "report.pdf", { type: "application/pdf" });
    const wizardData = { ...baseWizardData, files: [validFile] };
    await generateProposal(wizardData);
    expect(mockPost).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getProposalStatus — progress calculation branches
// ---------------------------------------------------------------------------

describe("getProposalStatus — progress calculation", () => {
  const baseStatusResponse = {
    id: 1,
    status: "generating",
    completed_sections: [],
    selected_sections: ["sec1", "sec2", "sec3"],
    visited_pipeline_steps: [],
    highest_visited_step: null,
  };

  it("uses backend progress_percent when > 0", async () => {
    mockGet.mockResolvedValue({ ...baseStatusResponse, progress_percent: 50 });
    const result = await getProposalStatus(1);
    expect(result.progressPercent).toBe(50);
  });

  it("calculates progress from completed/total when progress_percent=0 and sections completed", async () => {
    mockGet.mockResolvedValue({
      ...baseStatusResponse,
      progress_percent: 0,
      completed_sections: ["sec1"],
      selected_sections: ["sec1", "sec2"],
      total_sections: 2,
    });
    const result = await getProposalStatus(1);
    expect(result.progressPercent).toBe(50);
  });

  it("sets progressPercent=1 when generating with 0 completed and 0 progress", async () => {
    mockGet.mockResolvedValue({
      ...baseStatusResponse,
      status: "generating",
      progress_percent: 0,
      completed_sections: [],
      selected_sections: ["sec1", "sec2"],
      total_sections: 2,
    });
    const result = await getProposalStatus(1);
    expect(result.progressPercent).toBe(1);
  });

  it("leaves progressPercent at 0 when totalSections=0", async () => {
    mockGet.mockResolvedValue({
      ...baseStatusResponse,
      status: "completed",
      progress_percent: 0,
      completed_sections: [],
      selected_sections: null,
      total_sections: null,
    });
    const result = await getProposalStatus(1);
    expect(result.progressPercent).toBe(0);
  });

  it("uses progress field when progress_percent is absent", async () => {
    const response = { ...baseStatusResponse };
    delete (response as Record<string, unknown>)["progress_percent"];
    mockGet.mockResolvedValue({ ...response, progress: 75 });
    const result = await getProposalStatus(1);
    expect(result.progressPercent).toBe(75);
  });

  it("maps all status fields", async () => {
    mockGet.mockResolvedValue({
      ...baseStatusResponse,
      status: "completed",
      generating_section: null,
      current_stage: "review",
      visited_pipeline_steps: [1, 2],
      highest_visited_step: 3,
      total_sections: 5,
      progress_percent: 100,
    });
    const result = await getProposalStatus(1);
    expect(result.status).toBe("completed");
    expect(result.currentStage).toBe("review");
    expect(result.visitedPipelineSteps).toEqual([1, 2]);
    expect(result.highestVisitedStep).toBe(3);
    expect(result.totalSections).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// listProposals
// ---------------------------------------------------------------------------

describe("listProposals", () => {
  const rawListItem = {
    id: 1,
    title: "Proposal A",
    client_id: 5,
    client_name: "Acme",
    status: "completed",
    approval_status: "pending" as const,
    tone: "professional",
    length_preference: "balanced",
    template_type: "scratch" as const,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  };

  it("fetches page-based proposals without params", async () => {
    mockGet.mockResolvedValue([rawListItem]);
    const result = await listProposals();
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/proposals?page=1"),
      expect.anything()
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("uses page-based pagination when page param provided", async () => {
    mockGet.mockResolvedValue([rawListItem]);
    await listProposals({ page: 2, limit: 10 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("page=2"), expect.anything());
  });

  it("uses offset-based pagination when offset param provided", async () => {
    mockGet.mockResolvedValue([rawListItem]);
    await listProposals({ offset: 20, limit: 10 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("/proposals?"), expect.anything());
  });

  it("maps list item fields correctly", async () => {
    mockGet.mockResolvedValue([rawListItem]);
    const result = await listProposals();
    expect(result[0].clientId).toBe(5);
    expect(result[0].clientName).toBe("Acme");
    expect(result[0].version).toBeNull();
  });

  it("uses approvalStatus default 'pending' when missing", async () => {
    const itemNoStatus = { ...rawListItem, approval_status: undefined };
    mockGet.mockResolvedValue([itemNoStatus]);
    const result = await listProposals();
    expect(result[0].approvalStatus).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// listProposalHistory
// ---------------------------------------------------------------------------

describe("listProposalHistory", () => {
  const validResponse = {
    data: [
      {
        id: 1,
        title: "Old Proposal",
        client_id: 5,
        client_name: "Acme",
        status: "completed",
        approval_status: "pending" as const,
        tone: "professional",
        length_preference: "balanced",
        template_type: "scratch" as const,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
      },
    ],
    meta: { page: 1, per_page: 20, total: 1, total_pages: 1 },
  };

  it("returns paginated proposals on valid response", async () => {
    mockGet.mockResolvedValue(validResponse);
    const result = await listProposalHistory(1, 20);
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("sets hasMore=true when page < totalPages", async () => {
    const response = {
      data: [validResponse.data[0]],
      meta: { page: 1, per_page: 20, total: 40, total_pages: 2 },
    };
    mockGet.mockResolvedValue(response);
    const result = await listProposalHistory(1, 20);
    expect(result.hasMore).toBe(true);
  });

  it("throws when response has no data array", async () => {
    mockGet.mockResolvedValue({ meta: { page: 1, per_page: 20, total: 0, total_pages: 0 } });
    await expect(listProposalHistory()).rejects.toThrow("Invalid response");
  });

  it("throws when response.data is not an array", async () => {
    mockGet.mockResolvedValue({ data: "not-an-array", meta: {} });
    await expect(listProposalHistory()).rejects.toThrow("Invalid response");
  });

  it("throws when response is null", async () => {
    mockGet.mockResolvedValue(null);
    await expect(listProposalHistory()).rejects.toThrow("Invalid response");
  });

  it("throws when meta is missing", async () => {
    mockGet.mockResolvedValue({ data: [] });
    await expect(listProposalHistory()).rejects.toThrow("Missing pagination");
  });
});

// ---------------------------------------------------------------------------
// cancelProposal
// ---------------------------------------------------------------------------

describe("cancelProposal", () => {
  it("posts to /proposals/:id/cancel on success", async () => {
    mockPost.mockResolvedValue(null);
    await cancelProposal(5);
    expect(mockPost).toHaveBeenCalledWith("/proposals/5/cancel");
  });

  it("ignores 400 HttpError (already cancelled/completed)", async () => {
    const err = new (HttpError as new (code: number, msg: string) => Error)(400, "Already done");
    (err as Error & { statusCode: number }).statusCode = 400;
    mockPost.mockRejectedValue(err);
    await expect(cancelProposal(5)).resolves.toBeUndefined();
  });

  it("re-throws non-400 HttpError", async () => {
    const err = new (HttpError as new (code: number, msg: string) => Error)(500, "Server Error");
    (err as Error & { statusCode: number }).statusCode = 500;
    mockPost.mockRejectedValue(err);
    await expect(cancelProposal(5)).rejects.toThrow("Server Error");
  });

  it("re-throws generic errors", async () => {
    mockPost.mockRejectedValue(new Error("Network error"));
    await expect(cancelProposal(5)).rejects.toThrow("Network error");
  });
});

// ---------------------------------------------------------------------------
// updateApprovalStatus
// ---------------------------------------------------------------------------

describe("updateApprovalStatus", () => {
  it("patches approval status and returns mapped proposal", async () => {
    mockPatch.mockResolvedValue({ ...baseRawProposal, approval_status: "approved" });
    const result = await updateApprovalStatus(1, "approved");
    expect(mockPatch).toHaveBeenCalledWith("/proposals/1/approval-status", {
      approval_status: "approved",
    });
    expect(result.approvalStatus).toBe("approved");
  });

  it("works for 'rejected' status", async () => {
    mockPatch.mockResolvedValue({ ...baseRawProposal, approval_status: "rejected" });
    const result = await updateApprovalStatus(1, "rejected");
    expect(result.approvalStatus).toBe("rejected");
  });
});

// ---------------------------------------------------------------------------
// estimateProposalHours
// ---------------------------------------------------------------------------

describe("estimateProposalHours", () => {
  const rawEstimateResponse = {
    proposal_id: 1,
    estimated_hours_data: {
      total_estimated_hours: { hours: 200, description: "Total effort" },
      team_breakdown: [{ role: "Backend Dev", hours: 120, description: "API work" }],
      feature_list_used: "Feature A, Feature B",
      custom_prompt_used: null,
    },
  };

  it("posts to /proposals/:id/estimate-hours and returns mapped data", async () => {
    mockPost.mockResolvedValue(rawEstimateResponse);
    const result = await estimateProposalHours(1);
    expect(mockPost).toHaveBeenCalledWith("/proposals/1/estimate-hours", {});
    expect(result.totalEstimatedHours.hours).toBe(200);
    expect(result.teamBreakdown).toHaveLength(1);
    expect(result.featureListUsed).toBe("Feature A, Feature B");
  });

  it("passes custom body to the post", async () => {
    mockPost.mockResolvedValue(rawEstimateResponse);
    await estimateProposalHours(1, { custom_prompt: "Focus on backend" });
    expect(mockPost).toHaveBeenCalledWith("/proposals/1/estimate-hours", {
      custom_prompt: "Focus on backend",
    });
  });

  it("maps customPromptUsed as undefined when null", async () => {
    mockPost.mockResolvedValue(rawEstimateResponse);
    const result = await estimateProposalHours(1);
    expect(result.customPromptUsed).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getDownloadUrl
// ---------------------------------------------------------------------------

describe("getDownloadUrl", () => {
  it("returns a URL built from buildUrl", () => {
    const url = getDownloadUrl(42);
    expect(url).toContain("proposals/42/download");
  });
});

// ---------------------------------------------------------------------------
// generateProposal — slow API warning branch (line 137: requestDuration > 1000)
// ---------------------------------------------------------------------------

describe("generateProposal — slow API warning (line 137)", () => {
  it("logs a warning when request takes longer than 1000ms", async () => {
    const { logger } = jest.requireMock("@/utils/logger") as { logger: { warn: jest.Mock } };
    mockPost.mockResolvedValue({ id: 1, status: "generating", jobId: "job-slow" });

    // Date.now calls in generateProposal:
    //   1st: startTime = 0
    //   2nd: requestStartTime = 0
    //   3rd: Date.now() - requestStartTime → 2000 - 0 = 2000ms > 1000 → warn fires
    //   4th: Date.now() - startTime → 2000 - 0 = 2000ms
    const nowValues = [0, 0, 2000, 2000];
    let nowIdx = 0;
    jest.spyOn(Date, "now").mockImplementation(() => nowValues[nowIdx++] ?? 2000);

    await generateProposal(baseWizardData);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("longer than 1 second"),
      expect.any(Number),
      expect.any(String)
    );

    jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// listProposals — clientId branch (lines 397-401)
// ---------------------------------------------------------------------------

describe("listProposals — clientId branch (lines 397-401)", () => {
  const rawListItem = {
    id: 1,
    title: "Client Proposal",
    client_id: 7,
    client_name: "Widget Co",
    status: "completed",
    approval_status: "pending" as const,
    tone: "professional",
    length_preference: "balanced",
    template_type: "scratch" as const,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  };

  it("fetches with client_id query param when clientId provided", async () => {
    mockGet.mockResolvedValue([rawListItem]);
    const result = await listProposals({ clientId: 7 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("client_id=7"), expect.anything());
    expect(result[0].clientId).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// generateProposal — contextualInstructions null/undefined (line 74)
// ---------------------------------------------------------------------------

describe("generateProposal — contextualInstructions nullish (line 74)", () => {
  it("treats null contextualInstructions as empty string", async () => {
    mockPost.mockResolvedValue({ id: 1, status: "generating" });
    const wizardData = {
      ...baseWizardData,
      contextualInstructions: null as unknown as string,
    };
    await generateProposal(wizardData);
    const formData: FormData = mockPost.mock.calls[0][1];
    const payload = JSON.parse(formData.get("proposal_data") as string);
    // contextual is "" which becomes null in the payload
    expect(payload.contextual_instructions).toBeNull();
  });

  it("treats undefined contextualInstructions as empty string", async () => {
    mockPost.mockResolvedValue({ id: 1, status: "generating" });
    const wizardData = {
      ...baseWizardData,
      contextualInstructions: undefined as unknown as string,
    };
    await generateProposal(wizardData);
    const formData: FormData = mockPost.mock.calls[0][1];
    const payload = JSON.parse(formData.get("proposal_data") as string);
    expect(payload.contextual_instructions).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// generateProposal — separator branch (line 79): non-empty contextual + custom sections
// ---------------------------------------------------------------------------

describe("generateProposal — custom sections separator (line 79)", () => {
  it("uses \\n\\n separator when contextualInstructions is non-empty and custom sections exist", async () => {
    mockPost.mockResolvedValue({ id: 1, status: "generating" });
    const wizardData = {
      ...baseWizardData,
      contextualInstructions: "Existing instructions",
      customSections: [{ key: "custom_sec", label: "My Section", description: "Does stuff" }],
    };
    await generateProposal(wizardData);
    const formData: FormData = mockPost.mock.calls[0][1];
    const payload = JSON.parse(formData.get("proposal_data") as string);
    // Should contain both the original instructions and the custom block separated by \n\n
    expect(payload.contextual_instructions).toContain("Existing instructions");
    expect(payload.contextual_instructions).toContain("\n\n");
    expect(payload.contextual_instructions).toContain("My Section");
  });

  it("uses no separator when contextualInstructions is nullish and custom sections exist", async () => {
    mockPost.mockResolvedValue({ id: 1, status: "generating" });
    const wizardData = {
      ...baseWizardData,
      contextualInstructions: null as unknown as string,
      customSections: [{ key: "custom_sec", label: "My Section", description: "Does stuff" }],
    };
    await generateProposal(wizardData);
    const formData: FormData = mockPost.mock.calls[0][1];
    const payload = JSON.parse(formData.get("proposal_data") as string);
    // Should NOT start with \n\n since contextual was empty
    expect(payload.contextual_instructions).not.toMatch(/^\n\n/);
    expect(payload.contextual_instructions).toContain("My Section");
  });
});

// ---------------------------------------------------------------------------
// generateProposal — templateType || "scratch" and aiModel || DEFAULT_AI_MODEL (lines 99-100)
// ---------------------------------------------------------------------------

describe("generateProposal — falsy templateType and aiModel fallbacks (lines 99-100)", () => {
  it("falls back to 'scratch' when templateType is falsy", async () => {
    mockPost.mockResolvedValue({ id: 1, status: "generating" });
    const wizardData = {
      ...baseWizardData,
      templateType: "" as unknown as "scratch",
    };
    await generateProposal(wizardData);
    const formData: FormData = mockPost.mock.calls[0][1];
    const payload = JSON.parse(formData.get("proposal_data") as string);
    expect(payload.template_type).toBe("scratch");
  });

  it("falls back to DEFAULT_AI_MODEL when aiModel is falsy", async () => {
    mockPost.mockResolvedValue({ id: 1, status: "generating" });
    const wizardData = {
      ...baseWizardData,
      aiModel: "" as unknown as string,
    };
    await generateProposal(wizardData);
    const formData: FormData = mockPost.mock.calls[0][1];
    const payload = JSON.parse(formData.get("proposal_data") as string);
    expect(payload.ai_model).toBe("gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// generateProposal — file with no extension (line 111): ?? "" fallback
// ---------------------------------------------------------------------------

describe("generateProposal — file with no extension (line 111)", () => {
  it("throws unsupported file type error for file with no extension", async () => {
    // A file named just "README" has no extension — split('.').pop() returns "README" itself
    // but a file with name "." would give pop() undefined. Use a hidden-file-style name.
    // Actually: "nodotfile".split(".") = ["nodotfile"], pop() = "nodotfile" which is not in ALLOWED
    const noExtFile = new File(["content"], "nodotfile");
    const wizardData = { ...baseWizardData, files: [noExtFile] };
    await expect(generateProposal(wizardData)).rejects.toThrow("Unsupported file type");
  });
});

// ---------------------------------------------------------------------------
// getProposalStatus — missing optional fields (lines 179, 200-201, 204)
// ---------------------------------------------------------------------------

describe("getProposalStatus — missing optional API fields", () => {
  it("defaults completed_sections to [] when absent from response (line 179, 201)", async () => {
    mockGet.mockResolvedValue({
      id: 1,
      status: "pending",
      // completed_sections intentionally omitted
      selected_sections: ["sec1"],
    });
    const result = await getProposalStatus(1);
    expect(result.completedSections).toEqual([]);
  });

  it("defaults visited_pipeline_steps to [] when absent (line 204)", async () => {
    mockGet.mockResolvedValue({
      id: 1,
      status: "pending",
      completed_sections: [],
      // visited_pipeline_steps intentionally omitted
    });
    const result = await getProposalStatus(1);
    expect(result.visitedPipelineSteps).toEqual([]);
  });

  it("defaults generating_section to null when absent (line 200)", async () => {
    mockGet.mockResolvedValue({
      id: 1,
      status: "pending",
      completed_sections: [],
      // generating_section intentionally omitted
    });
    const result = await getProposalStatus(1);
    expect(result.generatingSection).toBeNull();
  });

  it("defaults both progress_percent and progress to 0 when both absent (line 184)", async () => {
    mockGet.mockResolvedValue({
      id: 1,
      status: "completed",
      completed_sections: [],
      selected_sections: null,
      total_sections: null,
      // progress_percent and progress both absent
    });
    const result = await getProposalStatus(1);
    expect(result.progressPercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// mapProposal — estimatedHoursData.customPromptUsed with a real string (line 282)
// and versioning fields with actual values (lines 287-289)
// ---------------------------------------------------------------------------

describe("mapProposal — estimatedHoursData.customPromptUsed string value (line 282)", () => {
  it("maps customPromptUsed when it has a real string value", async () => {
    mockGet.mockResolvedValue({
      ...baseRawProposal,
      estimated_hours_data: {
        total_estimated_hours: { hours: 50, description: "Total" },
        team_breakdown: [],
        feature_list_used: "Feature X",
        custom_prompt_used: "Focus on security",
      },
    });
    const result = await getProposal(1);
    expect(result.estimatedHoursData?.customPromptUsed).toBe("Focus on security");
  });
});

describe("mapProposal — versioning hierarchy fields with real values (lines 287-289)", () => {
  it("maps versionLabel, parentProposalId, rootProposalId when present", async () => {
    mockGet.mockResolvedValue({
      ...baseRawProposal,
      version_label: "v2",
      parent_proposal_id: 10,
      root_proposal_id: 5,
    });
    const result = await getProposal(1);
    expect(result.versionLabel).toBe("v2");
    expect(result.parentProposalId).toBe(10);
    expect(result.rootProposalId).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// estimateProposalHours — customPromptUsed with a real string (line 316)
// ---------------------------------------------------------------------------

describe("estimateProposalHours — customPromptUsed string value (line 316)", () => {
  it("maps customPromptUsed when custom_prompt_used has a real string", async () => {
    mockPost.mockResolvedValue({
      proposal_id: 1,
      estimated_hours_data: {
        total_estimated_hours: { hours: 100, description: "Total" },
        team_breakdown: [],
        feature_list_used: "Feature A",
        custom_prompt_used: "Prioritize mobile",
      },
    });
    const result = await estimateProposalHours(1);
    expect(result.customPromptUsed).toBe("Prioritize mobile");
  });
});

// ---------------------------------------------------------------------------
// mapProposalListItem — version fields with real values (lines 377-380)
// ---------------------------------------------------------------------------

describe("mapProposalListItem — versioning fields with real values (lines 377-380)", () => {
  const rawListItemWithVersions = {
    id: 2,
    title: "Versioned Proposal",
    client_id: 3,
    client_name: "Tech Corp",
    status: "completed",
    approval_status: "approved" as const,
    tone: "professional",
    length_preference: "balanced",
    template_type: "scratch" as const,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
    version: 3,
    version_label: "v3",
    parent_proposal_id: 1,
    root_proposal_id: 1,
  };

  it("maps version, versionLabel, parentProposalId, rootProposalId when present", async () => {
    mockGet.mockResolvedValue([rawListItemWithVersions]);
    const result = await listProposals();
    expect(result[0].version).toBe(3);
    expect(result[0].versionLabel).toBe("v3");
    expect(result[0].parentProposalId).toBe(1);
    expect(result[0].rootProposalId).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// listProposals — offset path without limit (lines 388-389): no per_page set
// ---------------------------------------------------------------------------

describe("listProposals — offset path without limit (lines 388-389)", () => {
  const rawListItem = {
    id: 1,
    title: "Proposal",
    client_id: 1,
    client_name: "Client",
    status: "completed",
    approval_status: "pending" as const,
    tone: "professional",
    length_preference: "balanced",
    template_type: "scratch" as const,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  };

  it("does not set per_page query param when limit is omitted", async () => {
    mockGet.mockResolvedValue([rawListItem]);
    await listProposals({ offset: 0 });
    const calledUrl: string = mockGet.mock.calls[0][0];
    expect(calledUrl).not.toContain("per_page");
    // page should be 1 because floor(0/10)+1 = 1
    expect(calledUrl).toContain("page=1");
  });

  it("computes correct page number from offset and default limit of 10", async () => {
    mockGet.mockResolvedValue([rawListItem]);
    await listProposals({ offset: 20 });
    const calledUrl: string = mockGet.mock.calls[0][0];
    // floor(20/10)+1 = 3
    expect(calledUrl).toContain("page=3");
  });
});

// ---------------------------------------------------------------------------
// updateApprovalStatus — with AbortSignal (line 485)
// ---------------------------------------------------------------------------

describe("updateApprovalStatus — with AbortSignal (line 485)", () => {
  it("passes signal to http.patch when signal is provided", async () => {
    mockPatch.mockResolvedValue({ ...baseRawProposal, approval_status: "approved" });
    const signal = new AbortController().signal;
    const result = await updateApprovalStatus(1, "approved", signal);
    expect(mockPatch).toHaveBeenCalledWith(
      "/proposals/1/approval-status",
      { approval_status: "approved" },
      { signal }
    );
    expect(result.approvalStatus).toBe("approved");
  });
});
