/**
 * Tests for useProposalDraftSync hook
 *
 * Coverage targets:
 *   - Delegates to useDraftPersistence with correct fixed params
 *   - enabled=false when proposal.status != "completed"
 *   - enabled=false when proposal is null
 *   - enabled=false when outer enabled=false
 *   - enabled=true only when proposal.status === "completed" and enabled=true
 */

import { renderHook } from "@testing-library/react";
import { useProposalDraftSync } from "@/hooks/useProposalDraftSync";
import type { ProposalData } from "@/interfaces/proposalInterfaces";

// ---------------------------------------------------------------------------
// Mock useDraftPersistence so we can inspect what it's called with
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useDraftPersistence", () => ({
  useDraftPersistence: jest.fn(),
}));

const { useDraftPersistence } = jest.requireMock("@/hooks/useDraftPersistence") as {
  useDraftPersistence: jest.Mock;
};

const baseProposal: ProposalData = {
  title: "Test Proposal",
  clientName: "Acme",
  description: "desc",
  tone: "professional",
  lengthPreference: "balanced",
  language: "English - US",
  aiModel: "gpt-4o",
  selectedSections: ["executive_summary"],
  sectionDisplayNames: {},
  customSections: [],
  contextualInstructions: "",
  webReferences: [],
  files: [],
  filesMeta: [],
  templateId: null,
  templateType: "scratch",
  status: "completed",
  approvalStatus: "pending",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useProposalDraftSync", () => {
  it("calls useDraftPersistence with fixed params (stage, wizardStep, lastLocation)", () => {
    renderHook(() =>
      useProposalDraftSync({
        proposalId: 42,
        proposal: baseProposal,
        activeSection: "executive_summary",
      })
    );

    expect(useDraftPersistence).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "generated",
        wizardStep: 5,
        lastLocation: "web_view",
        skipIfApproved: false,
      })
    );
  });

  it("passes enabled=true when proposal.status is completed and enabled=true", () => {
    renderHook(() =>
      useProposalDraftSync({
        proposalId: 42,
        proposal: { ...baseProposal, status: "completed" },
        activeSection: "intro",
      })
    );

    expect(useDraftPersistence).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("passes enabled=false when proposal.status is not completed", () => {
    renderHook(() =>
      useProposalDraftSync({
        proposalId: 42,
        proposal: { ...baseProposal, status: "generating" },
        activeSection: "intro",
      })
    );

    expect(useDraftPersistence).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("passes enabled=false when proposal is null", () => {
    renderHook(() =>
      useProposalDraftSync({
        proposalId: 42,
        proposal: null,
        activeSection: "intro",
      })
    );

    expect(useDraftPersistence).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("passes enabled=false when outer enabled=false regardless of status", () => {
    renderHook(() =>
      useProposalDraftSync({
        proposalId: 42,
        proposal: { ...baseProposal, status: "completed" },
        activeSection: "intro",
        enabled: false,
      })
    );

    expect(useDraftPersistence).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("forwards proposalId and activeSection correctly", () => {
    renderHook(() =>
      useProposalDraftSync({
        proposalId: 99,
        proposal: baseProposal,
        activeSection: "section_b",
      })
    );

    expect(useDraftPersistence).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 99,
        activeSection: "section_b",
      })
    );
  });
});
