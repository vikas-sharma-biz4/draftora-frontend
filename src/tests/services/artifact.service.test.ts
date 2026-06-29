/**
 * Tests for artifact.service.ts
 *
 * Coverage targets:
 *   - generateArtifact: all branch paths (options, invoiceMetadata, ndaMetadata, additionalInstructions, createdBy)
 *   - listArtifacts: all query-param combinations (clientId, proposalId, artifactType, no params)
 *   - updateArtifact: with/without title, with/without metadataJson
 *   - getArtifactDownloadUrl / getArtifactPdfUrl: buildUrl delegation
 *   - getMilestones: response mapping
 *   - transformArtifact: null vs non-null metadataJson, null createdBy
 */

import {
  generateArtifact,
  listArtifacts,
  updateArtifact,
  getArtifactDownloadUrl,
  getArtifactPdfUrl,
  getMilestones,
} from "@/services/artifact.service";
import { http, buildUrl } from "@/config/httpClient";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/config/httpClient", () => ({
  http: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
  buildUrl: jest.fn((path: string) => `https://api.example.com${path}`),
}));

const mockHttpPost = http.post as jest.Mock;
const mockHttpGet = http.get as jest.Mock;
const mockHttpPut = http.put as jest.Mock;
const mockBuildUrl = buildUrl as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rawArtifact = {
  id: 1,
  client_id: 10,
  proposal_id: 20,
  template_id: "tmpl-1",
  artifact_type: "invoice",
  title: "Invoice #1",
  content: "<html>invoice</html>",
  version: 1,
  metadata_json: null,
  created_by: "user@example.com",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBuildUrl.mockImplementation((path: string) => `https://api.example.com${path}`);
});

// ---------------------------------------------------------------------------
// generateArtifact
// ---------------------------------------------------------------------------

describe("artifact.service — generateArtifact", () => {
  it("sends a POST with minimal body when no optional fields provided", async () => {
    mockHttpPost.mockResolvedValue(rawArtifact);

    const result = await generateArtifact({
      clientId: 10,
      proposalId: 20,
      templateId: "tmpl-1",
      artifactType: "invoice",
      title: "Invoice #1",
    });

    const [endpoint, body, opts] = mockHttpPost.mock.calls[0];
    expect(endpoint).toBe("/artifacts/generate");
    expect(body).toMatchObject({
      client_id: 10,
      proposal_id: 20,
      template_id: "tmpl-1",
      artifact_type: "invoice",
      title: "Invoice #1",
      additional_instructions: null,
      created_by: null,
      options: undefined,
    });
    expect(opts).toMatchObject({ requestTimeout: 60_000 });
    expect(result.id).toBe(1);
    expect(result.artifactType).toBe("invoice");
  });

  it("includes options object (snake_case) when options are provided", async () => {
    mockHttpPost.mockResolvedValue(rawArtifact);

    await generateArtifact({
      clientId: 10,
      proposalId: 20,
      templateId: "tmpl-1",
      artifactType: "email",
      title: "Email",
      options: {
        includeSummary: true,
        includeScope: false,
        includeStrengths: true,
        includePodcast: false,
      },
    });

    const body = mockHttpPost.mock.calls[0][1];
    expect(body.options).toEqual({
      include_summary: true,
      include_scope: false,
      include_strengths: true,
      include_podcast: false,
    });
  });

  it("passes additionalInstructions and createdBy when provided", async () => {
    mockHttpPost.mockResolvedValue(rawArtifact);

    await generateArtifact({
      clientId: 10,
      proposalId: 20,
      templateId: "tmpl-1",
      artifactType: "invoice",
      title: "Invoice",
      additionalInstructions: "Focus on milestones",
      createdBy: "admin@example.com",
    });

    const body = mockHttpPost.mock.calls[0][1];
    expect(body.additional_instructions).toBe("Focus on milestones");
    expect(body.created_by).toBe("admin@example.com");
  });

  it("includes invoice_metadata with computed total_amount when invoiceMetadata is provided", async () => {
    mockHttpPost.mockResolvedValue(rawArtifact);

    await generateArtifact({
      clientId: 10,
      proposalId: 20,
      templateId: "tmpl-1",
      artifactType: "invoice",
      title: "Invoice",
      invoiceMetadata: {
        invoiceNumber: "INV-001",
        invoiceDate: "2025-01-01",
        clientName: "Acme",
        companyName: "Biz4Group",
        jobToBeDone: "Build website",
        milestoneCosts: [
          { milestone: "Design", amount: 1000 },
          { milestone: "Dev", amount: 2500 },
        ],
      },
    });

    const body = mockHttpPost.mock.calls[0][1];
    expect(body.invoice_metadata).toMatchObject({
      invoice_number: "INV-001",
      invoice_date: "2025-01-01",
      client_name: "Acme",
      company_name: "Biz4Group",
      job_to_be_done: "Build website",
      total_amount: 3500,
    });
    expect(body.invoice_metadata.milestone_costs).toHaveLength(2);
  });

  it("sets company_name to null when companyName is omitted from invoiceMetadata", async () => {
    mockHttpPost.mockResolvedValue(rawArtifact);

    await generateArtifact({
      clientId: 10,
      proposalId: 20,
      templateId: "tmpl-1",
      artifactType: "invoice",
      title: "Invoice",
      invoiceMetadata: {
        invoiceNumber: "INV-002",
        invoiceDate: "2025-01-01",
        clientName: "Acme",
        companyName: "",
        jobToBeDone: "Build app",
        milestoneCosts: [{ milestone: "M1", amount: 500 }],
      },
    });

    const body = mockHttpPost.mock.calls[0][1];
    expect(body.invoice_metadata.company_name).toBeNull();
  });

  it("includes nda_metadata when ndaMetadata is provided", async () => {
    mockHttpPost.mockResolvedValue(rawArtifact);

    await generateArtifact({
      clientId: 10,
      proposalId: 20,
      templateId: "tmpl-1",
      artifactType: "nda",
      title: "NDA",
      ndaMetadata: {
        clientName: "Acme",
        clientCompany: "Acme Corp",
        date: "2025-06-01",
      },
    });

    const body = mockHttpPost.mock.calls[0][1];
    expect(body.nda_metadata).toEqual({
      client_name: "Acme",
      client_company: "Acme Corp",
      date: "2025-06-01",
    });
  });

  it("does not include invoice_metadata when invoiceMetadata is absent", async () => {
    mockHttpPost.mockResolvedValue(rawArtifact);

    await generateArtifact({
      clientId: 10,
      proposalId: 20,
      templateId: "tmpl-1",
      artifactType: "invoice",
      title: "Invoice",
    });

    const body = mockHttpPost.mock.calls[0][1];
    expect(body.invoice_metadata).toBeUndefined();
    expect(body.nda_metadata).toBeUndefined();
  });

  it("transforms response to camelCase GeneratedArtifact with metadataJson", async () => {
    mockHttpPost.mockResolvedValue({
      ...rawArtifact,
      metadata_json: { invoice_number: "INV-001" },
      created_by: null,
    });

    const result = await generateArtifact({
      clientId: 10,
      proposalId: 20,
      templateId: "tmpl-1",
      artifactType: "invoice",
      title: "Invoice",
    });

    expect(result.metadataJson).toEqual({ invoice_number: "INV-001" });
    expect(result.createdBy).toBeNull();
    expect(result.clientId).toBe(10);
    expect(result.proposalId).toBe(20);
    expect(result.createdAt).toBe("2025-01-01T00:00:00Z");
    expect(result.updatedAt).toBe("2025-01-02T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// listArtifacts
// ---------------------------------------------------------------------------

describe("artifact.service — listArtifacts", () => {
  it("sends GET /artifacts with no query string when no params provided", async () => {
    mockHttpGet.mockResolvedValue([rawArtifact]);

    const results = await listArtifacts({});

    expect(mockHttpGet).toHaveBeenCalledWith("/artifacts");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("appends client_id param when clientId is provided", async () => {
    mockHttpGet.mockResolvedValue([]);

    await listArtifacts({ clientId: 5 });

    expect(mockHttpGet).toHaveBeenCalledWith("/artifacts?client_id=5");
  });

  it("appends proposal_id param when proposalId is provided", async () => {
    mockHttpGet.mockResolvedValue([]);

    await listArtifacts({ proposalId: 10 });

    expect(mockHttpGet).toHaveBeenCalledWith("/artifacts?proposal_id=10");
  });

  it("appends artifact_type param when artifactType is provided", async () => {
    mockHttpGet.mockResolvedValue([]);

    await listArtifacts({ artifactType: "invoice" });

    expect(mockHttpGet).toHaveBeenCalledWith("/artifacts?artifact_type=invoice");
  });

  it("includes all provided params in the query string", async () => {
    mockHttpGet.mockResolvedValue([]);

    await listArtifacts({ clientId: 5, proposalId: 10, artifactType: "nda" });

    const url = mockHttpGet.mock.calls[0][0];
    expect(url).toContain("client_id=5");
    expect(url).toContain("proposal_id=10");
    expect(url).toContain("artifact_type=nda");
  });

  it("transforms all items in the response array to camelCase", async () => {
    mockHttpGet.mockResolvedValue([
      rawArtifact,
      { ...rawArtifact, id: 2, created_by: null, metadata_json: { key: "val" } },
    ]);

    const results = await listArtifacts({ clientId: 5 });

    expect(results).toHaveLength(2);
    expect(results[0].artifactType).toBe("invoice");
    expect(results[1].createdBy).toBeNull();
    expect(results[1].metadataJson).toEqual({ key: "val" });
  });
});

// ---------------------------------------------------------------------------
// updateArtifact
// ---------------------------------------------------------------------------

describe("artifact.service — updateArtifact", () => {
  it("sends PUT with content only when title and metadataJson are absent", async () => {
    mockHttpPut.mockResolvedValue(rawArtifact);

    await updateArtifact(1, { content: "<html>new</html>" });

    const [endpoint, body] = mockHttpPut.mock.calls[0];
    expect(endpoint).toBe("/artifacts/1");
    expect(body.content).toBe("<html>new</html>");
    expect(body.title).toBeUndefined();
    expect(body.metadata_json).toBeUndefined();
  });

  it("includes title in the body when title is provided", async () => {
    mockHttpPut.mockResolvedValue(rawArtifact);

    await updateArtifact(1, { content: "<html/>", title: "Updated Title" });

    const body = mockHttpPut.mock.calls[0][1];
    expect(body.title).toBe("Updated Title");
  });

  it("includes metadata_json in the body when metadataJson is provided", async () => {
    mockHttpPut.mockResolvedValue(rawArtifact);

    await updateArtifact(1, { content: "<html/>", metadataJson: { version: 2 } });

    const body = mockHttpPut.mock.calls[0][1];
    expect(body.metadata_json).toEqual({ version: 2 });
  });

  it("includes both title and metadataJson when both are provided", async () => {
    mockHttpPut.mockResolvedValue(rawArtifact);

    await updateArtifact(1, {
      content: "<html/>",
      title: "Full Update",
      metadataJson: { key: "value" },
    });

    const body = mockHttpPut.mock.calls[0][1];
    expect(body.title).toBe("Full Update");
    expect(body.metadata_json).toEqual({ key: "value" });
  });

  it("returns the transformed artifact from the response", async () => {
    mockHttpPut.mockResolvedValue({ ...rawArtifact, title: "Updated Title" });

    const result = await updateArtifact(1, { content: "<html/>", title: "Updated Title" });

    expect(result.title).toBe("Updated Title");
    expect(result.id).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

describe("artifact.service — getArtifactDownloadUrl", () => {
  it("delegates to buildUrl with the correct DOCX path", () => {
    getArtifactDownloadUrl(5);
    expect(mockBuildUrl).toHaveBeenCalledWith("/artifacts/5/download?format=docx");
  });
});

describe("artifact.service — getArtifactPdfUrl", () => {
  it("delegates to buildUrl with the correct PDF path", () => {
    getArtifactPdfUrl(7);
    expect(mockBuildUrl).toHaveBeenCalledWith("/artifacts/7/download?format=pdf");
  });
});

// ---------------------------------------------------------------------------
// getMilestones
// ---------------------------------------------------------------------------

describe("artifact.service — getMilestones", () => {
  it("returns the milestones array from the API response", async () => {
    mockHttpGet.mockResolvedValue({
      proposal_id: 20,
      milestones: ["Design Phase", "Development Phase", "QA Phase"],
    });

    const milestones = await getMilestones(20);

    expect(milestones).toEqual(["Design Phase", "Development Phase", "QA Phase"]);
    expect(mockHttpGet).toHaveBeenCalledWith("/artifacts/milestones?proposal_id=20");
  });

  it("returns an empty array when milestones is empty", async () => {
    mockHttpGet.mockResolvedValue({ proposal_id: 20, milestones: [] });

    const milestones = await getMilestones(20);

    expect(milestones).toEqual([]);
  });
});
