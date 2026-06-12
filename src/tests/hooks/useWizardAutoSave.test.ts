/**
 * Tests for useWizardAutoSave hook
 *
 * Coverage targets:
 *   - No-op when enabled=false
 *   - Skips save on /generating page
 *   - Skips save for approved proposal
 *   - Skips save for rejected proposal
 *   - Skips save when fromHistory=true
 *   - Defers save when currentProposalId set but approvalStatus undefined
 *   - Registers beforeunload listener when enabled
 *   - Saves to localStorage fallback on beforeunload
 *   - Registers visibilitychange listener when enabled
 *   - Removes listeners on unmount
 *   - Debounced auto-save triggers after debounceMs
 */

import { renderHook, act } from "@testing-library/react";
import { useWizardAutoSave } from "@/hooks/useWizardAutoSave";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockPathname = "/parameters";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSaveDraftToStore = jest.fn().mockResolvedValue({ id: "new-draft" });
const mockUpdateDraftInStore = jest.fn().mockResolvedValue(undefined);
const mockSetCurrentDraftId = jest.fn();

// Stable wizard selector values — override per-test as needed
let wizardState = {
  title: "My Proposal",
  clientName: "Acme",
  clientId: undefined as number | undefined,
  description: "desc",
  selectedSections: ["executive_summary"] as string[],
  sectionDisplayNames: {} as Record<string, string>,
  customSections: [] as unknown[],
  tone: "professional",
  lengthPreference: "balanced",
  language: "English",
  aiModel: "gpt-4o",
  templateId: null as string | null,
  templateType: "scratch" as string,
  filesMeta: [] as unknown[],
  selectedDocumentIds: [] as string[],
  webReferences: [] as string[],
  currentStep: 1,
  maxStepReached: 1,
  currentProposalId: null as number | null,
  generatedProposalId: null as number | null,
};

jest.mock("@/store/features/wizard/proposalWizardSlice", () => ({
  useProposalTitle: () => wizardState.title,
  useClientName: () => wizardState.clientName,
  useClientId: () => wizardState.clientId,
  useProposalDescription: () => wizardState.description,
  useSelectedSections: () => wizardState.selectedSections,
  useSectionDisplayNames: () => wizardState.sectionDisplayNames,
  useCustomSections: () => wizardState.customSections,
  useTone: () => wizardState.tone,
  useLengthPreference: () => wizardState.lengthPreference,
  useLanguage: () => wizardState.language,
  useAiModel: () => wizardState.aiModel,
  useTemplateId: () => wizardState.templateId,
  useTemplateType: () => wizardState.templateType,
  useFilesMeta: () => wizardState.filesMeta,
  useSelectedDocumentIds: () => wizardState.selectedDocumentIds,
  useWebReferences: () => wizardState.webReferences,
  useCurrentStep: () => wizardState.currentStep,
  useMaxStepReached: () => wizardState.maxStepReached,
  useCurrentProposalId: () => wizardState.currentProposalId,
  useGeneratedProposalId: () => wizardState.generatedProposalId,
  useWizardActions: () => ({ setCurrentProposalId: jest.fn() }),
  useEditMode: () => false,
}));

let draftSessionState = {
  draftStage: "wizard_in_progress" as string,
  completedSteps: [1] as number[],
  currentDraftId: null as string | null,
  fromHistory: false,
};

jest.mock("@/store/features/drafts/draftSessionSlice", () => ({
  useDraftSessionStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      draftStage: draftSessionState.draftStage,
      completedSteps: draftSessionState.completedSteps,
      currentDraftId: draftSessionState.currentDraftId,
      fromHistory: draftSessionState.fromHistory,
      setCurrentDraftId: mockSetCurrentDraftId,
    })
  ),
}));

jest.mock("@/store/features/drafts/draftSlice", () => ({
  useDraftStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      saveDraft: mockSaveDraftToStore,
      updateDraftApi: mockUpdateDraftInStore,
    })
  ),
}));

jest.mock("@/services/draft.service", () => ({
  getDraftByProposalId: jest.fn().mockResolvedValue(null),
  getDraft: jest.fn().mockResolvedValue({ generatedContent: {} }),
}));

jest.mock("@/utils/draftUtils", () => ({
  buildDraftProposalData: jest.fn().mockReturnValue({}),
  buildDraftPayload: jest.fn().mockReturnValue({ generatedContent: {} }),
}));

jest.mock("@/config/httpClient", () => ({
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(msg: string, statusCode: number) {
      super(msg);
      this.statusCode = statusCode;
    }
  },
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
  mockPathname = "/parameters";
  // Reset to default data-rich state
  wizardState = {
    title: "My Proposal",
    clientName: "Acme",
    clientId: undefined,
    description: "desc",
    selectedSections: ["executive_summary"],
    sectionDisplayNames: {},
    tone: "professional",
    lengthPreference: "balanced",
    language: "English",
    aiModel: "gpt-4o",
    templateId: null,
    templateType: "scratch",
    filesMeta: [],
    selectedDocumentIds: [],
    webReferences: [],
    currentStep: 1,
    maxStepReached: 1,
    currentProposalId: null,
    generatedProposalId: null,
  };
  draftSessionState = {
    draftStage: "wizard_in_progress",
    completedSteps: [1],
    currentDraftId: null,
    fromHistory: false,
  };
});

afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useWizardAutoSave — guard conditions", () => {
  it("does not register beforeunload when enabled=false", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    renderHook(() => useWizardAutoSave({ enabled: false }));

    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("beforeunload");
    addSpy.mockRestore();
  });

  it("skips save on /generating page", async () => {
    mockPathname = "/generating/1";
    renderHook(() => useWizardAutoSave({ enabled: true }));

    act(() => jest.runAllTimers());

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("skips save for approved proposal", async () => {
    renderHook(() => useWizardAutoSave({ enabled: true, approvalStatus: "approved" }));

    act(() => jest.runAllTimers());

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("skips save for rejected proposal", async () => {
    renderHook(() => useWizardAutoSave({ enabled: true, approvalStatus: "rejected" }));

    act(() => jest.runAllTimers());

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("skips save when fromHistory=true", async () => {
    draftSessionState.fromHistory = true;
    renderHook(() => useWizardAutoSave({ enabled: true }));

    act(() => jest.runAllTimers());

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("defers save when currentProposalId is set but approvalStatus is undefined", async () => {
    wizardState.currentProposalId = 5;
    renderHook(() => useWizardAutoSave({ enabled: true, approvalStatus: undefined }));

    act(() => jest.runAllTimers());

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("skips save when no meaningful data", async () => {
    wizardState.title = "";
    wizardState.clientName = "";
    wizardState.description = "";
    wizardState.selectedSections = [];
    wizardState.clientId = undefined;

    renderHook(() => useWizardAutoSave({ enabled: true }));

    act(() => jest.runAllTimers());

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });
});

describe("useWizardAutoSave — event listeners", () => {
  it("registers beforeunload when enabled=true", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    renderHook(() => useWizardAutoSave({ enabled: true }));

    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain("beforeunload");
    addSpy.mockRestore();
  });

  it("registers visibilitychange when enabled=true", () => {
    const addSpy = jest.spyOn(document, "addEventListener");
    renderHook(() => useWizardAutoSave({ enabled: true }));

    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain("visibilitychange");
    addSpy.mockRestore();
  });

  it("removes event listeners on unmount", () => {
    const removeWindowSpy = jest.spyOn(window, "removeEventListener");
    const removeDocSpy = jest.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useWizardAutoSave({ enabled: true }));
    unmount();

    const windowEvents = removeWindowSpy.mock.calls.map((c) => c[0]);
    const docEvents = removeDocSpy.mock.calls.map((c) => c[0]);

    expect(windowEvents).toContain("beforeunload");
    expect(docEvents).toContain("visibilitychange");

    removeWindowSpy.mockRestore();
    removeDocSpy.mockRestore();
  });
});

describe("useWizardAutoSave — beforeunload fallback save", () => {
  it("saves data to localStorage on beforeunload when there is data", () => {
    renderHook(() => useWizardAutoSave({ enabled: true }));

    window.dispatchEvent(new Event("beforeunload"));

    const saved = localStorage.getItem("wizard_autosave_fallback");
    expect(saved).not.toBeNull();

    const parsed = JSON.parse(saved!);
    expect(parsed.proposalData.title).toBe("My Proposal");
    expect(parsed.proposalData.clientName).toBe("Acme");
  });

  it("does not save to localStorage when there is no data", () => {
    wizardState.title = "";
    wizardState.clientName = "";
    wizardState.description = "";
    wizardState.selectedSections = [];
    wizardState.clientId = undefined;

    renderHook(() => useWizardAutoSave({ enabled: true }));

    window.dispatchEvent(new Event("beforeunload"));

    expect(localStorage.getItem("wizard_autosave_fallback")).toBeNull();
  });
});

describe("useWizardAutoSave — debounced auto-save", () => {
  it("triggers save after debounceMs when data exists", async () => {
    jest.useRealTimers();
    jest.useFakeTimers();

    renderHook(() => useWizardAutoSave({ enabled: true, debounceMs: 100 }));

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSaveDraftToStore).toHaveBeenCalledTimes(1);
  });
});

describe("useWizardAutoSave — visibilitychange", () => {
  it("triggers save when tab becomes hidden and there is data", async () => {
    renderHook(() => useWizardAutoSave({ enabled: true }));

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    // Flush promises from the async save call
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // saveDraft is called when visible=false and hasData()=true
    // All guards pass → mockSaveDraftToStore should be called
    expect(mockSaveDraftToStore).toHaveBeenCalled();

    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });

  it("does not trigger save when tab becomes visible", async () => {
    renderHook(() => useWizardAutoSave({ enabled: true }));

    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });
});

describe("useWizardAutoSave — dedup prevention", () => {
  it("skips save if same data was created within 10 seconds", async () => {
    // Set dedup entry with same title and recent timestamp
    localStorage.setItem(
      "draft_dedup",
      JSON.stringify({
        title: "My Proposal",
        clientName: "Acme",
        timestamp: Date.now() - 1000, // 1 second ago
      })
    );

    renderHook(() => useWizardAutoSave({ enabled: true }));

    act(() => jest.runAllTimers());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });

  it("allows save if dedup entry is older than 10 seconds", async () => {
    localStorage.setItem(
      "draft_dedup",
      JSON.stringify({
        title: "My Proposal",
        clientName: "Acme",
        timestamp: Date.now() - 15000, // 15 seconds ago
      })
    );

    renderHook(() => useWizardAutoSave({ enabled: true, debounceMs: 100 }));

    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSaveDraftToStore).toHaveBeenCalled();
  });
});

describe("useWizardAutoSave — update existing draft", () => {
  it("updates existing draft when currentDraftId is set", async () => {
    draftSessionState.currentDraftId = "existing-draft-123";
    mockUpdateDraftInStore.mockResolvedValue(undefined);

    renderHook(() => useWizardAutoSave({ enabled: true, debounceMs: 100 }));

    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUpdateDraftInStore).toHaveBeenCalledWith("existing-draft-123", expect.any(Object));
    expect(mockSaveDraftToStore).not.toHaveBeenCalled();
  });
});

describe("useWizardAutoSave — route change save", () => {
  it("saves when navigating away from /parameters", async () => {
    // Start on parameters page
    mockPathname = "/parameters";
    const { rerender } = renderHook(() => useWizardAutoSave({ enabled: true }));

    // Navigate away to a non-wizard page
    mockPathname = "/dashboard";
    rerender();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Should call saveDraft because we're leaving the wizard
    expect(mockSaveDraftToStore).toHaveBeenCalled();
  });
});

describe("useWizardAutoSave — timeout clearing", () => {
  it("clears previous debounce timeout when effect re-runs", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    const { rerender } = renderHook(() => useWizardAutoSave({ enabled: true, debounceMs: 500 }));

    // Trigger re-render to cause effect to re-run (which should clear previous timeout)
    act(() => {
      wizardState.title = "Updated Title";
    });
    rerender();

    // clearTimeout should have been called on re-render
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
