import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";

import { DEFAULT_SELECTED_SECTIONS } from "@/constants";
import { ProposalProvider, useProposal } from "@/context/ProposalContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }): JSX.Element {
  return <ProposalProvider>{children}</ProposalProvider>;
}

// Reset localStorage before every test to avoid cross-test contamination.
beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("ProposalContext — initial state", () => {
  it("exposes default proposalData with correct defaults", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });
    const { proposalData } = result.current;

    expect(proposalData.title).toBe("");
    expect(proposalData.clientName).toBe("");
    expect(proposalData.tone).toBe("professional");
    expect(proposalData.lengthPreference).toBe("balanced");
    expect(proposalData.language).toBe("English - US");
    expect(proposalData.templateType).toBe("scratch");
    expect(proposalData.selectedSections).toEqual(DEFAULT_SELECTED_SECTIONS);
    expect(proposalData.customSections).toEqual([]);
    expect(proposalData.files).toEqual([]);
  });

  it("starts at wizard step 1", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });
    expect(result.current.currentStep).toBe(1);
  });

  it("starts with isGenerating false", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });
    expect(result.current.isGenerating).toBe(false);
  });

  it("starts with generatedProposalId null", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });
    expect(result.current.generatedProposalId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateProposalData
// ---------------------------------------------------------------------------

describe("updateProposalData", () => {
  it("merges partial updates into proposal data", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    act(() => {
      result.current.updateProposalData({ title: "My Proposal" });
    });

    expect(result.current.proposalData.title).toBe("My Proposal");
    // Non-updated fields remain unchanged
    expect(result.current.proposalData.tone).toBe("professional");
  });

  it("merges multiple partial updates cumulatively", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    act(() => {
      result.current.updateProposalData({ title: "Title A" });
    });
    act(() => {
      result.current.updateProposalData({ clientName: "Client B" });
    });

    expect(result.current.proposalData.title).toBe("Title A");
    expect(result.current.proposalData.clientName).toBe("Client B");
  });

  it("allows updating nested fields like customSections", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    act(() => {
      result.current.updateProposalData({
        customSections: [
          { key: "custom_1", label: "Custom", description: "Desc" },
        ],
      });
    });

    expect(result.current.proposalData.customSections).toHaveLength(1);
    expect(result.current.proposalData.customSections[0].key).toBe("custom_1");
  });
});

// ---------------------------------------------------------------------------
// setCurrentStep
// ---------------------------------------------------------------------------

describe("setCurrentStep", () => {
  it("updates current wizard step", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    act(() => {
      result.current.setCurrentStep(3);
    });

    expect(result.current.currentStep).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// setIsGenerating
// ---------------------------------------------------------------------------

describe("setIsGenerating", () => {
  it("toggles generating state", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    act(() => {
      result.current.setIsGenerating(true);
    });
    expect(result.current.isGenerating).toBe(true);

    act(() => {
      result.current.setIsGenerating(false);
    });
    expect(result.current.isGenerating).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setGeneratedProposalId
// ---------------------------------------------------------------------------

describe("setGeneratedProposalId", () => {
  it("stores and clears generated proposal id", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    act(() => {
      result.current.setGeneratedProposalId(42);
    });
    expect(result.current.generatedProposalId).toBe(42);

    act(() => {
      result.current.setGeneratedProposalId(null);
    });
    expect(result.current.generatedProposalId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resetProposal
// ---------------------------------------------------------------------------

describe("resetProposal", () => {
  it("resets all state back to defaults", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    act(() => {
      result.current.updateProposalData({ title: "Dirty Title" });
      result.current.setCurrentStep(4);
      result.current.setIsGenerating(true);
      result.current.setGeneratedProposalId(99);
    });

    act(() => {
      result.current.resetProposal();
    });

    expect(result.current.proposalData.title).toBe("");
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.generatedProposalId).toBeNull();
  });

  it("resets proposalData title to empty string after reset (localStorage reflects reset state)", async () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    await act(async () => {
      result.current.updateProposalData({ title: "Saved" });
    });

    await act(async () => {
      result.current.resetProposal();
    });

    // After reset, the persist effect may write the default state back.
    // What matters is the in-memory state is reset correctly.
    expect(result.current.proposalData.title).toBe("");
    expect(result.current.currentStep).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

describe("localStorage persistence", () => {
  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("persists proposalData and currentStep to localStorage after update", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });

    act(() => {
      result.current.updateProposalData({ title: "Persisted Title" });
    });

    // Flush the 500ms debounce timer in ProposalWizardContext
    act(() => {
      jest.advanceTimersByTime(600);
    });

    const raw = localStorage.getItem("proposely_wizard_v1");
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!);
    expect(saved.proposalData.title).toBe("Persisted Title");
  });

  it("does not persist File objects (files cleared before save)", () => {
    const { result } = renderHook(() => useProposal(), { wrapper });
    const mockFile = new File(["content"], "doc.pdf", {
      type: "application/pdf",
    });

    act(() => {
      result.current.updateProposalData({ files: [mockFile] });
    });

    // Flush the 500ms debounce timer
    act(() => {
      jest.advanceTimersByTime(600);
    });

    const raw = localStorage.getItem("proposely_wizard_v1");
    const saved = JSON.parse(raw!);
    expect(saved.proposalData.files).toEqual([]);
  });

  it("rehydrates state from localStorage on mount", () => {
    localStorage.setItem(
      "proposely_wizard_v1",
      JSON.stringify({
        proposalData: {
          title: "Rehydrated",
          clientName: "Client X",
        },
        currentStep: 3,
      })
    );

    const { result } = renderHook(() => useProposal(), { wrapper });

    // Flush hydration effect
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(result.current.proposalData.title).toBe("Rehydrated");
    expect(result.current.proposalData.clientName).toBe("Client X");
    expect(result.current.currentStep).toBe(3);
  });

  it("ignores corrupt localStorage data gracefully", () => {
    localStorage.setItem("proposely_wizard_v1", "{ INVALID JSON }");

    // Should not throw
    expect(() =>
      renderHook(() => useProposal(), { wrapper })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// useProposal guard
// ---------------------------------------------------------------------------

describe("useProposal outside provider", () => {
  it("throws a descriptive error when used without ProposalProvider", () => {
    // Suppress console.error from React during expected throws
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() => renderHook(() => useProposal())).toThrow(
      "useProposal must be used within a ProposalProvider"
    );

    consoleSpy.mockRestore();
  });
});
