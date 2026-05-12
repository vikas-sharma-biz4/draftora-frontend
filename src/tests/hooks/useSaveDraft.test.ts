import { act, renderHook } from "@testing-library/react";
import React from "react";

import { DRAFTS_STORAGE_KEY } from "@/constants";
import { ProposalProvider } from "@/context/ProposalContext";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import type { SavedDraft } from "@/hooks/useSaveDraft";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocking so we get the mocked versions
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }): JSX.Element {
  return React.createElement(ProposalProvider, null, children);
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockPush.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSaveDraft", () => {
  it("shows error toast when proposal has no title or clientName", () => {
    const { result } = renderHook(() => useSaveDraft(), { wrapper });

    act(() => {
      result.current();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Nothing to save — add a title or client name first."
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(localStorage.getItem(DRAFTS_STORAGE_KEY)).toBeNull();
  });

  it("saves draft to localStorage when title is present", async () => {
    const { result, rerender } = renderHook(
      () => ({
        saveDraft: useSaveDraft(),
        ctx: require("@/context/ProposalContext").useProposal(),
      }),
      { wrapper }
    );

    // Set a title via context
    act(() => {
      result.current.ctx.updateProposalData({ title: "My Draft Proposal" });
    });

    rerender();

    act(() => {
      result.current.saveDraft();
    });

    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const drafts = JSON.parse(raw!) as SavedDraft[];
    expect(drafts).toHaveLength(1);
    expect(drafts[0].title).toBe("My Draft Proposal");
  });

  it("saves draft when only clientName is provided", async () => {
    const { result, rerender } = renderHook(
      () => ({
        saveDraft: useSaveDraft(),
        ctx: require("@/context/ProposalContext").useProposal(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.ctx.updateProposalData({ clientName: "Acme Corp" });
    });

    rerender();

    act(() => {
      result.current.saveDraft();
    });

    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const drafts = JSON.parse(raw!) as SavedDraft[];
    expect(drafts[0].clientName).toBe("Acme Corp");
    expect(drafts[0].title).toBe("Untitled Proposal");
  });

  it("prepends new draft to existing drafts list", async () => {
    const existingDraft: SavedDraft = {
      id: "111",
      savedAt: new Date().toISOString(),
      title: "Old Draft",
      clientName: "Old Client",
      currentStep: 1,
      proposalData: { title: "Old Draft" },
    };
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify([existingDraft]));

    const { result, rerender } = renderHook(
      () => ({
        saveDraft: useSaveDraft(),
        ctx: require("@/context/ProposalContext").useProposal(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.ctx.updateProposalData({ title: "New Draft" });
    });

    rerender();

    act(() => {
      result.current.saveDraft();
    });

    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    const drafts = JSON.parse(raw!) as SavedDraft[];
    expect(drafts).toHaveLength(2);
    expect(drafts[0].title).toBe("New Draft");
    expect(drafts[1].title).toBe("Old Draft");
  });

  it("stores currentStep in the draft", async () => {
    const { result, rerender } = renderHook(
      () => ({
        saveDraft: useSaveDraft(),
        ctx: require("@/context/ProposalContext").useProposal(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.ctx.updateProposalData({ title: "Draft With Step" });
      result.current.ctx.setCurrentStep(3);
    });

    rerender();

    act(() => {
      result.current.saveDraft();
    });

    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    const drafts = JSON.parse(raw!) as SavedDraft[];
    expect(drafts[0].currentStep).toBe(3);
  });

  it("does not persist File objects in saved draft", async () => {
    const { result, rerender } = renderHook(
      () => ({
        saveDraft: useSaveDraft(),
        ctx: require("@/context/ProposalContext").useProposal(),
      }),
      { wrapper }
    );

    const mockFile = new File(["content"], "doc.pdf", {
      type: "application/pdf",
    });

    act(() => {
      result.current.ctx.updateProposalData({
        title: "With Files",
        files: [mockFile],
      });
    });

    rerender();

    act(() => {
      result.current.saveDraft();
    });

    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    const drafts = JSON.parse(raw!) as SavedDraft[];
    expect(drafts[0].proposalData.files).toEqual([]);
  });

  it("navigates to / after saving", async () => {
    const { result, rerender } = renderHook(
      () => ({
        saveDraft: useSaveDraft(),
        ctx: require("@/context/ProposalContext").useProposal(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.ctx.updateProposalData({ title: "Navigate Test" });
    });

    rerender();

    act(() => {
      result.current.saveDraft();
    });

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("shows success toast with draft title after saving", async () => {
    const { result, rerender } = renderHook(
      () => ({
        saveDraft: useSaveDraft(),
        ctx: require("@/context/ProposalContext").useProposal(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.ctx.updateProposalData({ title: "Toast Test" });
    });

    rerender();

    act(() => {
      result.current.saveDraft();
    });

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Toast Test")
    );
  });

  it("resets proposal state after saving", async () => {
    const { result, rerender } = renderHook(
      () => ({
        saveDraft: useSaveDraft(),
        ctx: require("@/context/ProposalContext").useProposal(),
      }),
      { wrapper }
    );

    act(() => {
      result.current.ctx.updateProposalData({ title: "Reset After Save" });
    });

    rerender();

    act(() => {
      result.current.saveDraft();
    });

    expect(result.current.ctx.proposalData.title).toBe("");
    expect(result.current.ctx.currentStep).toBe(1);
  });
});
