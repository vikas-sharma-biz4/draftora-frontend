/**
 * Tests for proposalWizardSlice.ts
 *
 * Coverage targets:
 *   - updateProposalData: partial merge, overwrite, array storage
 *   - setCurrentStep / setMaxStepReached
 *   - Boolean flag setters (setIsGenerating, setEditMode)
 *   - Proposal ID setters (setGeneratedProposalId, setCurrentProposalId)
 *   - resetProposal: clears proposalData fields
 *   - reset: restores all state to defaults
 *   - prefetchRecommendations: loading → success / loading → error state transitions
 *   - cancelRecommendationsFetch / invalidateRecommendationsCache / clearRecommendationsError
 *   - Granular selector hooks return correct slices
 */

import { act, renderHook } from "@testing-library/react";

import {
  useProposalWizardStore,
  useProposalTitle,
  useClientName,
  useCurrentStep,
  useMaxStepReached,
  useIsGenerating,
  useGeneratedProposalId,
  useCurrentProposalId,
  useRecommendationsFetchStatus,
  useRecommendationsError,
} from "@/store/features/wizard/proposalWizardSlice";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// The slice calls the recommendations service which uses http.post internally
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

// Template parser service is called by prefetchRecommendations
jest.mock("@/services/proposal/templateParser.service", () => ({
  getSectionRecommendations: jest.fn(),
}));

import { getSectionRecommendations } from "@/services/proposal/templateParser.service";
const mockGetSectionRecommendations = getSectionRecommendations as jest.Mock;

// ---------------------------------------------------------------------------
// Reset helper
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  act(() => {
    useProposalWizardStore.getState().reset();
  });
});

// ---------------------------------------------------------------------------
// updateProposalData
// ---------------------------------------------------------------------------

describe("proposalWizardSlice — updateProposalData", () => {
  it("merges a partial update into proposalData without losing other fields", () => {
    act(() => {
      useProposalWizardStore.getState().updateProposalData({ title: "First Title" });
    });
    act(() => {
      useProposalWizardStore.getState().updateProposalData({ clientName: "Acme Corp" });
    });

    const { proposalData } = useProposalWizardStore.getState();
    expect(proposalData.title).toBe("First Title");
    expect(proposalData.clientName).toBe("Acme Corp");
  });

  it("overwrites the same key when updated a second time", () => {
    act(() => {
      useProposalWizardStore.getState().updateProposalData({ title: "Old Title" });
    });
    act(() => {
      useProposalWizardStore.getState().updateProposalData({ title: "New Title" });
    });

    expect(useProposalWizardStore.getState().proposalData.title).toBe("New Title");
  });

  it("stores a selectedSections array correctly", () => {
    const sections = ["executive_summary", "proposed_solution", "timeline"];
    act(() => {
      useProposalWizardStore.getState().updateProposalData({ selectedSections: sections });
    });

    expect(useProposalWizardStore.getState().proposalData.selectedSections).toEqual(sections);
  });

  it("stores tone and length preference", () => {
    act(() => {
      useProposalWizardStore.getState().updateProposalData({
        tone: "technical",
        lengthPreference: "comprehensive",
      });
    });

    const { proposalData } = useProposalWizardStore.getState();
    expect(proposalData.tone).toBe("technical");
    expect(proposalData.lengthPreference).toBe("comprehensive");
  });

  it("stores sectionDisplayNames map correctly", () => {
    const names = { executive_summary: "Executive Overview" };
    act(() => {
      useProposalWizardStore.getState().updateProposalData({ sectionDisplayNames: names });
    });

    expect(useProposalWizardStore.getState().proposalData.sectionDisplayNames).toEqual(names);
  });
});

// ---------------------------------------------------------------------------
// setCurrentStep / setMaxStepReached
// ---------------------------------------------------------------------------

describe("proposalWizardSlice — step tracking", () => {
  it("setCurrentStep updates currentStep", () => {
    act(() => {
      useProposalWizardStore.getState().setCurrentStep(2);
    });
    expect(useProposalWizardStore.getState().currentStep).toBe(2);
  });

  it("setMaxStepReached updates maxStepReached", () => {
    act(() => {
      useProposalWizardStore.getState().setMaxStepReached(3);
    });
    expect(useProposalWizardStore.getState().maxStepReached).toBe(3);
  });

  it("initial currentStep is 1", () => {
    expect(useProposalWizardStore.getState().currentStep).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Boolean flag setters
// ---------------------------------------------------------------------------

describe("proposalWizardSlice — boolean flags", () => {
  it("setIsGenerating toggles the generating flag", () => {
    act(() => {
      useProposalWizardStore.getState().setIsGenerating(true);
    });
    expect(useProposalWizardStore.getState().isGenerating).toBe(true);

    act(() => {
      useProposalWizardStore.getState().setIsGenerating(false);
    });
    expect(useProposalWizardStore.getState().isGenerating).toBe(false);
  });

  it("setEditMode toggles edit mode", () => {
    act(() => {
      useProposalWizardStore.getState().setEditMode(true);
    });
    expect(useProposalWizardStore.getState().editMode).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Proposal ID setters
// ---------------------------------------------------------------------------

describe("proposalWizardSlice — proposal ID tracking", () => {
  it("setGeneratedProposalId stores the ID", () => {
    act(() => {
      useProposalWizardStore.getState().setGeneratedProposalId(42);
    });
    expect(useProposalWizardStore.getState().generatedProposalId).toBe(42);
  });

  it("setCurrentProposalId stores the ID", () => {
    act(() => {
      useProposalWizardStore.getState().setCurrentProposalId(99);
    });
    expect(useProposalWizardStore.getState().currentProposalId).toBe(99);
  });

  it("setGeneratedProposalId can be set back to null", () => {
    act(() => {
      useProposalWizardStore.getState().setGeneratedProposalId(42);
    });
    act(() => {
      useProposalWizardStore.getState().setGeneratedProposalId(null);
    });
    expect(useProposalWizardStore.getState().generatedProposalId).toBeNull();
  });

  it("setCurrentProposalId can be set back to null", () => {
    act(() => {
      useProposalWizardStore.getState().setCurrentProposalId(5);
    });
    act(() => {
      useProposalWizardStore.getState().setCurrentProposalId(null);
    });
    expect(useProposalWizardStore.getState().currentProposalId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resetProposal / reset
// ---------------------------------------------------------------------------

describe("proposalWizardSlice — resetProposal", () => {
  it("clears title and clientName in proposalData", () => {
    act(() => {
      useProposalWizardStore.getState().updateProposalData({
        title: "Draft Title",
        clientName: "Acme Corp",
      });
    });

    act(() => {
      useProposalWizardStore.getState().resetProposal();
    });

    const { proposalData } = useProposalWizardStore.getState();
    expect(proposalData.title).toBe("");
    expect(proposalData.clientName).toBe("");
  });

  it("restores selectedSections to the default set (not empty)", () => {
    act(() => {
      useProposalWizardStore.getState().updateProposalData({
        selectedSections: ["executive_summary"],
      });
    });

    act(() => {
      useProposalWizardStore.getState().resetProposal();
    });

    // resetProposal restores the default selectedSections from constants, not an empty array
    expect(useProposalWizardStore.getState().proposalData.selectedSections.length).toBeGreaterThan(
      0
    );
  });
});

describe("proposalWizardSlice — reset (full)", () => {
  it("restores currentStep to 1", () => {
    act(() => {
      useProposalWizardStore.getState().setCurrentStep(3);
    });
    act(() => {
      useProposalWizardStore.getState().reset();
    });
    expect(useProposalWizardStore.getState().currentStep).toBe(1);
  });

  it("clears generatedProposalId and currentProposalId", () => {
    act(() => {
      useProposalWizardStore.getState().setGeneratedProposalId(10);
      useProposalWizardStore.getState().setCurrentProposalId(20);
    });
    act(() => {
      useProposalWizardStore.getState().reset();
    });
    expect(useProposalWizardStore.getState().generatedProposalId).toBeNull();
    expect(useProposalWizardStore.getState().currentProposalId).toBeNull();
  });

  it("resets isGenerating to false", () => {
    act(() => {
      useProposalWizardStore.getState().setIsGenerating(true);
    });
    act(() => {
      useProposalWizardStore.getState().reset();
    });
    expect(useProposalWizardStore.getState().isGenerating).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// prefetchRecommendations — async state transitions
// ---------------------------------------------------------------------------

describe("proposalWizardSlice — prefetchRecommendations", () => {
  it("transitions status to 'success' and stores recommendations on success", async () => {
    const fakeRecs = { sections: ["executive_summary", "proposed_solution"] };
    mockGetSectionRecommendations.mockResolvedValue(fakeRecs);

    await act(async () => {
      await useProposalWizardStore.getState().prefetchRecommendations();
    });

    const { recommendationsFetchStatus, prefetchedRecommendations } =
      useProposalWizardStore.getState();
    expect(recommendationsFetchStatus).toBe("success");
    expect(prefetchedRecommendations).toEqual(fakeRecs);
  });

  it("transitions status to 'error' and stores the error message on failure", async () => {
    mockGetSectionRecommendations.mockRejectedValue(new Error("API unavailable"));

    await act(async () => {
      await useProposalWizardStore.getState().prefetchRecommendations();
    });

    const { recommendationsFetchStatus, recommendationsError } = useProposalWizardStore.getState();
    expect(recommendationsFetchStatus).toBe("error");
    expect(recommendationsError).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// cancelRecommendationsFetch / invalidateRecommendationsCache / clearRecommendationsError
// ---------------------------------------------------------------------------

describe("proposalWizardSlice — recommendation cache management", () => {
  it("clearRecommendationsError sets error to null", async () => {
    mockGetSectionRecommendations.mockRejectedValue(new Error("fail"));
    await act(async () => {
      await useProposalWizardStore.getState().prefetchRecommendations();
    });

    act(() => {
      useProposalWizardStore.getState().clearRecommendationsError();
    });
    expect(useProposalWizardStore.getState().recommendationsError).toBeNull();
  });

  it("invalidateRecommendationsCache clears prefetchedRecommendations", async () => {
    mockGetSectionRecommendations.mockResolvedValue({ sections: [] });
    await act(async () => {
      await useProposalWizardStore.getState().prefetchRecommendations();
    });

    act(() => {
      useProposalWizardStore.getState().invalidateRecommendationsCache();
    });
    expect(useProposalWizardStore.getState().prefetchedRecommendations).toBeNull();
  });

  it("cancelRecommendationsFetch resets status to 'idle'", () => {
    act(() => {
      useProposalWizardStore.getState().cancelRecommendationsFetch();
    });
    expect(useProposalWizardStore.getState().recommendationsFetchStatus).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// Granular selector hooks
// ---------------------------------------------------------------------------

describe("proposalWizardSlice — granular selector hooks", () => {
  it("useProposalTitle returns the current title", () => {
    act(() => {
      useProposalWizardStore.getState().updateProposalData({ title: "Selector Title" });
    });
    const { result } = renderHook(() => useProposalTitle());
    expect(result.current).toBe("Selector Title");
  });

  it("useClientName returns the current client name", () => {
    act(() => {
      useProposalWizardStore.getState().updateProposalData({ clientName: "Hook Corp" });
    });
    const { result } = renderHook(() => useClientName());
    expect(result.current).toBe("Hook Corp");
  });

  it("useCurrentStep returns 1 after reset", () => {
    const { result } = renderHook(() => useCurrentStep());
    expect(result.current).toBe(1);
  });

  it("useMaxStepReached reflects setMaxStepReached calls", () => {
    act(() => {
      useProposalWizardStore.getState().setMaxStepReached(2);
    });
    const { result } = renderHook(() => useMaxStepReached());
    expect(result.current).toBe(2);
  });

  it("useIsGenerating returns false initially", () => {
    const { result } = renderHook(() => useIsGenerating());
    expect(result.current).toBe(false);
  });

  it("useGeneratedProposalId returns null initially", () => {
    const { result } = renderHook(() => useGeneratedProposalId());
    expect(result.current).toBeNull();
  });

  it("useCurrentProposalId reflects setCurrentProposalId", () => {
    act(() => {
      useProposalWizardStore.getState().setCurrentProposalId(77);
    });
    const { result } = renderHook(() => useCurrentProposalId());
    expect(result.current).toBe(77);
  });

  it("useRecommendationsFetchStatus returns 'idle' initially", () => {
    const { result } = renderHook(() => useRecommendationsFetchStatus());
    expect(result.current).toBe("idle");
  });

  it("useRecommendationsError returns null initially", () => {
    const { result } = renderHook(() => useRecommendationsError());
    expect(result.current).toBeNull();
  });
});
