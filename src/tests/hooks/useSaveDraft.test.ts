/**
 * Tests for useSaveDraft hook
 *
 * Coverage targets:
 *   - isSavingRef guard prevents concurrent saves
 *   - Blocks save for approved/rejected proposals
 *   - Blocks save when approvalStatus is loading with a linked proposalId
 *   - Blocks save when no title and no clientName
 *   - Blocks save when clientName is empty
 *   - Creates new draft when no currentDraftId
 *   - Updates existing draft when currentDraftId exists
 *   - Falls back to create when update returns 404
 *   - Navigates to / and resets wizard after successful save
 *   - Shows toast error on unexpected API failure
 *   - generatedContent cache: skips API fetch when cache is populated (M3)
 *   - generatedContent cache: fetches and caches on first save, skips on second (M3)
 */

import { renderHook, act } from "@testing-library/react";
import { useSaveDraft } from "@/hooks/useSaveDraft";
import { HttpError } from "@/config/httpClient";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Navigation mock — the factory creates a single push jest.fn() in its closure
// so every call to useRouter() returns the same reference.
// ts-jest cannot hoist external variable declarations into factory bodies,
// so we keep the mock entirely self-contained and retrieve the reference later
// via jest.requireMock.
// ---------------------------------------------------------------------------

let mockPathnameValue = "/parameters";

jest.mock("next/navigation", () => {
  const pushFn = jest.fn();
  return {
    useRouter: () => ({ push: pushFn }),
    usePathname: () => mockPathnameValue,
  };
});

jest.mock("@/utils/toast", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
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

jest.mock("@/constants/messages", () => ({
  MESSAGES: {
    DRAFT_SAVE_REJECTED: "Cannot save — proposal already reviewed.",
    DRAFT_SAVE_LOADING: "Loading proposal status, please wait.",
    DRAFT_SAVED: "Draft saved successfully.",
  },
}));

// Stable references to mock functions — assigned in beforeEach via jest.requireMock
// so they always point to the singleton jest.fn() instances created in each factory.
let mockPush: jest.Mock;
let mockToastError: jest.Mock;
let mockToastSuccess: jest.Mock;

// ---------------------------------------------------------------------------
// Wizard store — mutable state read via getState() inside useSaveDraft
// ---------------------------------------------------------------------------

const wizardState = {
  title: "Test Proposal",
  clientName: "Acme Corp",
  clientId: 1 as number | null,
  description: "Description",
  selectedSections: ["executive_summary"],
  sectionDisplayNames: {} as Record<string, string>,
  tone: "professional",
  lengthPreference: "medium",
  language: "en",
  aiModel: "claude",
  templateId: "saas" as string | null,
  templateType: "predefined",
  filesMeta: [] as unknown[],
  selectedDocumentIds: [] as number[],
  webReferences: [] as unknown[],
  currentStep: 2,
  maxStepReached: 2,
  currentProposalId: null as number | null,
  generatedProposalId: null as number | null,
  approvalStatus: undefined as string | undefined,
};

const mockResetProposal = jest.fn();

jest.mock("@/store/features/wizard/proposalWizardSlice", () => ({
  useProposalWizardStore: {
    getState: () => ({
      proposalData: {
        title: wizardState.title,
        clientName: wizardState.clientName,
        clientId: wizardState.clientId,
        description: wizardState.description,
        selectedSections: wizardState.selectedSections,
        sectionDisplayNames: wizardState.sectionDisplayNames,
        tone: wizardState.tone,
        lengthPreference: wizardState.lengthPreference,
        language: wizardState.language,
        aiModel: wizardState.aiModel,
        templateId: wizardState.templateId,
        templateType: wizardState.templateType,
        filesMeta: wizardState.filesMeta,
        selectedDocumentIds: wizardState.selectedDocumentIds,
        webReferences: wizardState.webReferences,
        approvalStatus: wizardState.approvalStatus,
      },
      currentStep: wizardState.currentStep,
      maxStepReached: wizardState.maxStepReached,
      currentProposalId: wizardState.currentProposalId,
      generatedProposalId: wizardState.generatedProposalId,
      resetProposal: mockResetProposal,
    }),
  },
}));

// ---------------------------------------------------------------------------
// Draft session store
// ---------------------------------------------------------------------------

const mockSetCurrentDraftId = jest.fn();
const mockSetGeneratedContent = jest.fn();
let mockCurrentDraftId: string | null = null;
let mockGeneratedContent: Record<string, string> = {};

jest.mock("@/store/features/drafts/draftSessionSlice", () => ({
  useDraftSessionStore: {
    getState: () => ({
      currentDraftId: mockCurrentDraftId,
      draftStage: "wizard_in_progress",
      completedSteps: [1],
      setCurrentDraftId: mockSetCurrentDraftId,
      generatedContent: mockGeneratedContent,
      setGeneratedContent: mockSetGeneratedContent,
    }),
  },
}));

// ---------------------------------------------------------------------------
// Draft store
// ---------------------------------------------------------------------------

const mockSaveDraftToStore = jest.fn();
const mockUpdateDraftInStore = jest.fn();

jest.mock("@/store/features/drafts/draftSlice", () => ({
  useDraftStore: {
    getState: () => ({
      saveDraft: mockSaveDraftToStore,
      updateDraftApi: mockUpdateDraftInStore,
    }),
  },
}));

// ---------------------------------------------------------------------------
// Draft service
// ---------------------------------------------------------------------------

const mockGetDraftByProposalId = jest.fn();
const mockGetDraft = jest.fn();

jest.mock("@/services/draft.service", () => ({
  updateDraft: jest.fn(),
  getDraftByProposalId: (...args: unknown[]) => mockGetDraftByProposalId(...args),
  getDraft: (...args: unknown[]) => mockGetDraft(...args),
}));

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  // Obtain stable references to mock functions from the module registry.
  // Must be done after jest.clearAllMocks() so fresh call counts are tracked.
  const toastModule = jest.requireMock("@/utils/toast") as {
    toast: { error: jest.Mock; success: jest.Mock };
  };
  mockToastError = toastModule.toast.error;
  mockToastSuccess = toastModule.toast.success;

  // The navigation factory creates a single pushFn in its closure;
  // every useRouter() call returns the same reference.
  // Assigning to the module-level let gives assertions a correct handle.
  const navModule = jest.requireMock("next/navigation") as {
    useRouter: () => { push: jest.Mock };
  };
  mockPush = navModule.useRouter().push;

  mockPathnameValue = "/parameters";
  mockCurrentDraftId = null;
  mockGeneratedContent = {};
  wizardState.title = "Test Proposal";
  wizardState.clientName = "Acme Corp";
  wizardState.currentProposalId = null;
  wizardState.approvalStatus = undefined;
  mockGetDraftByProposalId.mockResolvedValue(null);
  mockGetDraft.mockResolvedValue({ generatedContent: {} });
  mockSaveDraftToStore.mockResolvedValue({ id: "new-draft-1" });
  mockUpdateDraftInStore.mockResolvedValue({ id: "existing-draft-1" });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Early-exit conditions
// ---------------------------------------------------------------------------

describe("useSaveDraft — early-exit conditions", () => {
  it("shows rejected error and does not save when approvalStatus is approved", async () => {
    wizardState.approvalStatus = "approved";
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockToastError).toHaveBeenCalledWith("Cannot save — proposal already reviewed.");
    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("shows rejected error and does not save when approvalStatus is rejected", async () => {
    wizardState.approvalStatus = "rejected";
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockToastError).toHaveBeenCalledWith("Cannot save — proposal already reviewed.");
    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("shows loading error when proposalId is set but approvalStatus is undefined", async () => {
    wizardState.currentProposalId = 42;
    wizardState.approvalStatus = undefined;
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockToastError).toHaveBeenCalledWith("Loading proposal status, please wait.");
    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("shows no-data error when both title and clientName are empty", async () => {
    wizardState.title = "";
    wizardState.clientName = "";
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Nothing to save — add a title or client name first."
    );
    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("shows client-name error when clientName is empty even if title has content", async () => {
    wizardState.title = "My Proposal";
    wizardState.clientName = "";
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Please enter a client name before saving the draft."
    );
    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// isSavingRef guard
// ---------------------------------------------------------------------------

describe("useSaveDraft — isSavingRef concurrent-save guard", () => {
  it("blocks a second call while the first is still in progress", async () => {
    let resolveFirst!: (v: { id: string }) => void;
    mockSaveDraftToStore.mockReturnValueOnce(
      new Promise<{ id: string }>((resolve) => {
        resolveFirst = resolve;
      })
    );

    const { result } = renderHook(() => useSaveDraft());

    const firstSavePromise = result.current();

    await act(async () => {
      await result.current();
    });

    expect(mockSaveDraftToStore).toHaveBeenCalledTimes(1);

    resolveFirst({ id: "draft-1" });
    await act(async () => {
      await firstSavePromise;
    });
  });

  it("allows a new save after the previous one completes", async () => {
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });
    expect(mockSaveDraftToStore).toHaveBeenCalledTimes(1);

    mockSaveDraftToStore.mockResolvedValueOnce({ id: "draft-2" });
    await act(async () => {
      await result.current();
    });
    expect(mockSaveDraftToStore).toHaveBeenCalledTimes(2);
  });

  it("releases the lock in the finally block even when the save throws", async () => {
    mockSaveDraftToStore.mockRejectedValueOnce(new Error("Server error"));
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    mockSaveDraftToStore.mockResolvedValueOnce({ id: "draft-recovery" });
    await act(async () => {
      await result.current();
    });
    expect(mockSaveDraftToStore).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Create new draft path
// ---------------------------------------------------------------------------

describe("useSaveDraft — create new draft", () => {
  it("calls saveDraftToStore with correct payload when no currentDraftId", async () => {
    mockCurrentDraftId = null;
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockSaveDraftToStore).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Proposal",
        clientName: "Acme Corp",
        status: "draft",
        lastLocation: "wizard_parameters",
      })
    );
    expect(mockSetCurrentDraftId).toHaveBeenCalledWith("new-draft-1");
    expect(mockToastSuccess).toHaveBeenCalledWith("Draft saved successfully.");
  });

  it("navigates to / after successful create", async () => {
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("calls resetProposal inside setTimeout after navigation", async () => {
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(mockResetProposal).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Update existing draft path
// ---------------------------------------------------------------------------

describe("useSaveDraft — update existing draft", () => {
  it("calls updateDraftInStore when currentDraftId exists", async () => {
    mockCurrentDraftId = "existing-draft-1";
    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockUpdateDraftInStore).toHaveBeenCalledWith(
      "existing-draft-1",
      expect.objectContaining({ title: "Test Proposal", clientName: "Acme Corp" })
    );
    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith("Draft saved successfully.");
  });

  it("falls back to create when update returns 404", async () => {
    mockCurrentDraftId = "stale-draft-id";
    const notFound = new HttpError(404, "Not found");
    mockUpdateDraftInStore.mockRejectedValueOnce(notFound);
    mockSaveDraftToStore.mockResolvedValueOnce({ id: "fallback-draft" });

    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockSetCurrentDraftId).toHaveBeenNthCalledWith(1, null);
    expect(mockSaveDraftToStore).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentDraftId).toHaveBeenNthCalledWith(2, "fallback-draft");
    expect(mockToastSuccess).toHaveBeenCalledWith("Draft saved successfully.");
  });

  it("shows error toast when update throws a non-404 error", async () => {
    mockCurrentDraftId = "existing-draft-1";
    mockUpdateDraftInStore.mockRejectedValueOnce(new Error("Internal server error"));

    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockToastError).toHaveBeenCalledWith("Internal server error");
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// M3: generatedContent cache — eliminates redundant API round-trips
// ---------------------------------------------------------------------------

describe("useSaveDraft — generatedContent cache (M3)", () => {
  it("skips API fetch entirely when cache already has content", async () => {
    wizardState.currentProposalId = 10;
    wizardState.approvalStatus = "pending";
    mockGeneratedContent = { intro: "Cached intro content" };

    const { result } = renderHook(() => useSaveDraft());
    await act(async () => {
      await result.current();
    });

    expect(mockGetDraftByProposalId).not.toHaveBeenCalled();
    expect(mockGetDraft).not.toHaveBeenCalled();
  });

  it("fetches from API and calls setGeneratedContent when cache is empty and proposalId exists", async () => {
    wizardState.currentProposalId = 10;
    wizardState.approvalStatus = "pending";
    mockGeneratedContent = {};
    mockGetDraftByProposalId.mockResolvedValueOnce({ id: "draft-abc" });
    mockGetDraft.mockResolvedValueOnce({ generatedContent: { intro: "Generated intro" } });

    const { result } = renderHook(() => useSaveDraft());
    await act(async () => {
      await result.current();
    });

    expect(mockGetDraftByProposalId).toHaveBeenCalledWith(10);
    expect(mockGetDraft).toHaveBeenCalledWith("draft-abc");
    expect(mockSetGeneratedContent).toHaveBeenCalledWith({ intro: "Generated intro" });
  });

  it("skips API fetch when proposalId is null even if cache is empty", async () => {
    wizardState.currentProposalId = null;
    wizardState.approvalStatus = undefined;
    mockGeneratedContent = {};

    const { result } = renderHook(() => useSaveDraft());
    await act(async () => {
      await result.current();
    });

    expect(mockGetDraftByProposalId).not.toHaveBeenCalled();
  });

  it("proceeds with save even when draft fetch throws (graceful degradation)", async () => {
    wizardState.currentProposalId = 10;
    wizardState.approvalStatus = "pending";
    mockGeneratedContent = {};
    mockGetDraftByProposalId.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useSaveDraft());
    await act(async () => {
      await result.current();
    });

    // Save should still complete successfully despite the fetch failure
    expect(mockSaveDraftToStore).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith("Draft saved successfully.");
  });
});

// ---------------------------------------------------------------------------
// lastLocation computation — pathname branches (lines 111-113)
// ---------------------------------------------------------------------------

describe("useSaveDraft — lastLocation based on pathname", () => {
  it("sets lastLocation=wizard_review when pathname is /review", async () => {
    mockPathnameValue = "/review";
    wizardState.approvalStatus = undefined; // no proposalId guard
    wizardState.currentProposalId = null;

    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockSaveDraftToStore).toHaveBeenCalledWith(
      expect.objectContaining({ lastLocation: "wizard_review" })
    );
  });

  it("sets lastLocation=web_view when pathname starts with /proposal/", async () => {
    mockPathnameValue = "/proposal/99";
    wizardState.approvalStatus = undefined;
    wizardState.currentProposalId = null;

    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockSaveDraftToStore).toHaveBeenCalledWith(
      expect.objectContaining({ lastLocation: "web_view" })
    );
  });

  it("defaults lastLocation=wizard_parameters for unknown pathname", async () => {
    mockPathnameValue = "/unknown-page";
    wizardState.approvalStatus = undefined;
    wizardState.currentProposalId = null;

    const { result } = renderHook(() => useSaveDraft());

    await act(async () => {
      await result.current();
    });

    expect(mockSaveDraftToStore).toHaveBeenCalledWith(
      expect.objectContaining({ lastLocation: "wizard_parameters" })
    );
  });
});
