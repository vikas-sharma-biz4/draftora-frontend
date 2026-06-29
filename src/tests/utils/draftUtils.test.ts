/**
 * Tests for src/utils/draftUtils.ts
 *
 * Coverage targets:
 *   - buildDraftProposalData: spreads input, always sets files=[] and contextualInstructions=""
 *   - buildDraftPayload: hasEdits !== undefined (line 74 true branch)
 *   - buildDraftPayload: hasEdits === undefined (line 74 false branch — no payload.hasEdits key)
 *   - buildDraftPayload: proposalId fallback (?? null)
 *   - buildDraftPayload: title fallback (|| "Untitled Proposal")
 *   - buildDraftPayload: clientName fallback (|| "")
 *   - buildDraftPayload: status fallback (?? "draft")
 */

import { buildDraftProposalData, buildDraftPayload } from "@/utils/draftUtils";
import type { BuildDraftPayloadOptions } from "@/utils/draftUtils";
import type { DraftUIState } from "@/interfaces/draftInterfaces";
import type { ProposalWizardData } from "@/interfaces/proposalInterfaces";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseWizardData: ProposalWizardData = {
  title: "Test Proposal",
  clientName: "Acme",
  description: "A test proposal",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  aiModel: "gpt-4o",
  selectedSections: ["executive_summary"],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "do this",
  webReferences: [],
  files: [new File([""], "file.txt")],
  filesMeta: [],
  templateId: null,
  templateType: "scratch",
};

const uiState: DraftUIState = {
  activeSection: "executive_summary",
  scrollPosition: 0,
  expandedSections: [],
  lastVisibleSection: null,
};

function baseOptions(overrides?: Partial<BuildDraftPayloadOptions>): BuildDraftPayloadOptions {
  return {
    proposalId: 1,
    title: "My Proposal",
    clientName: "Client Co",
    lastLocation: "web_view",
    stage: "generated",
    proposalData: baseWizardData,
    currentStep: 3,
    maxStepReached: 5,
    completedSteps: [1, 2, 3],
    generatedContent: { executive_summary: "<p>Hello</p>" },
    uiState,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildDraftProposalData
// ---------------------------------------------------------------------------

describe("buildDraftProposalData", () => {
  it("spreads input and resets files to empty array", () => {
    const result = buildDraftProposalData(baseWizardData);
    expect(result.files).toEqual([]);
    expect(result.title).toBe("Test Proposal");
  });

  it("always sets contextualInstructions to empty string", () => {
    const result = buildDraftProposalData(baseWizardData);
    expect(result.contextualInstructions).toBe("");
  });

  it("passes through customSections", () => {
    const input = { ...baseWizardData, customSections: ["extras"] };
    const result = buildDraftProposalData(input);
    expect(result.customSections).toEqual(["extras"]);
  });
});

// ---------------------------------------------------------------------------
// buildDraftPayload — hasEdits branch (line 74)
// ---------------------------------------------------------------------------

describe("buildDraftPayload — hasEdits branch", () => {
  it("includes hasEdits=true in payload when options.hasEdits is true (true branch)", () => {
    const payload = buildDraftPayload(baseOptions({ hasEdits: true }));
    expect(payload.hasEdits).toBe(true);
  });

  it("includes hasEdits=false in payload when options.hasEdits is false", () => {
    const payload = buildDraftPayload(baseOptions({ hasEdits: false }));
    expect(payload.hasEdits).toBe(false);
  });

  it("does not set hasEdits when options.hasEdits is undefined (false branch)", () => {
    const options = baseOptions();
    delete (options as Partial<BuildDraftPayloadOptions>).hasEdits;
    const payload = buildDraftPayload(options);
    expect(Object.prototype.hasOwnProperty.call(payload, "hasEdits")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildDraftPayload — fallback branches
// ---------------------------------------------------------------------------

describe("buildDraftPayload — proposalId fallback", () => {
  it("uses provided proposalId when not null", () => {
    const payload = buildDraftPayload(baseOptions({ proposalId: 42 }));
    expect(payload.proposalId).toBe(42);
  });

  it("falls back to null when proposalId is undefined (?? null branch)", () => {
    const payload = buildDraftPayload(baseOptions({ proposalId: undefined }));
    expect(payload.proposalId).toBeNull();
  });

  it("falls back to null when proposalId is null", () => {
    const payload = buildDraftPayload(baseOptions({ proposalId: null }));
    expect(payload.proposalId).toBeNull();
  });
});

describe("buildDraftPayload — title fallback", () => {
  it("uses provided title when non-empty", () => {
    const payload = buildDraftPayload(baseOptions({ title: "My Proposal" }));
    expect(payload.title).toBe("My Proposal");
  });

  it("falls back to 'Untitled Proposal' when title is empty string", () => {
    const payload = buildDraftPayload(baseOptions({ title: "" }));
    expect(payload.title).toBe("Untitled Proposal");
  });
});

describe("buildDraftPayload — clientName fallback", () => {
  it("uses provided clientName when non-empty", () => {
    const payload = buildDraftPayload(baseOptions({ clientName: "Acme" }));
    expect(payload.clientName).toBe("Acme");
  });

  it("falls back to empty string when clientName is empty", () => {
    const payload = buildDraftPayload(baseOptions({ clientName: "" }));
    expect(payload.clientName).toBe("");
  });
});

describe("buildDraftPayload — status fallback", () => {
  it("uses provided status when supplied", () => {
    const payload = buildDraftPayload(baseOptions({ status: "active" }));
    expect(payload.status).toBe("active");
  });

  it("defaults to 'draft' when status is undefined (?? 'draft' branch)", () => {
    const options = baseOptions();
    delete (options as Partial<BuildDraftPayloadOptions>).status;
    const payload = buildDraftPayload(options);
    expect(payload.status).toBe("draft");
  });
});
