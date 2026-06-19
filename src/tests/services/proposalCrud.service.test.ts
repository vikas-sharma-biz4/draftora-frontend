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
  files: [],
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
