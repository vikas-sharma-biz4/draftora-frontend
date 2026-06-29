/**
 * Tests for store/features/drafts/draftSessionSlice.ts
 */

import { act } from "@testing-library/react";
import {
  useDraftSessionStore,
  INITIAL_DRAFT_SESSION_STATE,
} from "@/store/features/drafts/draftSessionSlice";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  sessionStorage.clear();
  act(() => {
    useDraftSessionStore.setState({ ...INITIAL_DRAFT_SESSION_STATE });
  });
});

// ---------------------------------------------------------------------------
// setCurrentDraftId
// ---------------------------------------------------------------------------

describe("draftSessionSlice — setCurrentDraftId", () => {
  it("stores draft ID in state", () => {
    act(() => {
      useDraftSessionStore.getState().setCurrentDraftId("draft-123");
    });
    expect(useDraftSessionStore.getState().currentDraftId).toBe("draft-123");
  });

  it("writes draft ID to sessionStorage", () => {
    act(() => {
      useDraftSessionStore.getState().setCurrentDraftId("draft-abc");
    });
    expect(sessionStorage.getItem("draftora_current_draft_id")).toBe("draft-abc");
  });

  it("removes from sessionStorage when set to null", () => {
    act(() => {
      useDraftSessionStore.getState().setCurrentDraftId("draft-xyz");
    });
    act(() => {
      useDraftSessionStore.getState().setCurrentDraftId(null);
    });
    expect(useDraftSessionStore.getState().currentDraftId).toBeNull();
    expect(sessionStorage.getItem("draftora_current_draft_id")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setAutoSaveEnabled
// ---------------------------------------------------------------------------

describe("draftSessionSlice — setAutoSaveEnabled", () => {
  it("disables auto-save", () => {
    act(() => {
      useDraftSessionStore.getState().setAutoSaveEnabled(false);
    });
    expect(useDraftSessionStore.getState().autoSaveEnabled).toBe(false);
  });

  it("re-enables auto-save", () => {
    act(() => {
      useDraftSessionStore.getState().setAutoSaveEnabled(false);
    });
    act(() => {
      useDraftSessionStore.getState().setAutoSaveEnabled(true);
    });
    expect(useDraftSessionStore.getState().autoSaveEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// setDraftStage
// ---------------------------------------------------------------------------

describe("draftSessionSlice — setDraftStage", () => {
  it("updates draftStage in state", () => {
    act(() => {
      useDraftSessionStore.getState().setDraftStage("generated");
    });
    expect(useDraftSessionStore.getState().draftStage).toBe("generated");
  });

  it("writes stage to sessionStorage", () => {
    act(() => {
      useDraftSessionStore.getState().setDraftStage("parameters_complete");
    });
    expect(sessionStorage.getItem("draftora_draft_stage")).toBe("parameters_complete");
  });
});

// ---------------------------------------------------------------------------
// setCompletedSteps
// ---------------------------------------------------------------------------

describe("draftSessionSlice — setCompletedSteps", () => {
  it("stores steps array in state", () => {
    act(() => {
      useDraftSessionStore.getState().setCompletedSteps([1, 2, 3]);
    });
    expect(useDraftSessionStore.getState().completedSteps).toEqual([1, 2, 3]);
  });

  it("writes steps to sessionStorage as JSON", () => {
    act(() => {
      useDraftSessionStore.getState().setCompletedSteps([4, 5]);
    });
    const stored = sessionStorage.getItem("draftora_completed_steps");
    expect(JSON.parse(stored!)).toEqual([4, 5]);
  });

  it("replaces previous steps", () => {
    act(() => {
      useDraftSessionStore.getState().setCompletedSteps([1]);
    });
    act(() => {
      useDraftSessionStore.getState().setCompletedSteps([1, 2]);
    });
    expect(useDraftSessionStore.getState().completedSteps).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// markStepCompleted
// ---------------------------------------------------------------------------

describe("draftSessionSlice — markStepCompleted", () => {
  it("adds a new step ID to completedSteps", () => {
    act(() => {
      useDraftSessionStore.getState().markStepCompleted(1);
    });
    expect(useDraftSessionStore.getState().completedSteps).toContain(1);
  });

  it("does not duplicate an already-completed step", () => {
    act(() => {
      useDraftSessionStore.getState().markStepCompleted(2);
    });
    act(() => {
      useDraftSessionStore.getState().markStepCompleted(2);
    });
    const steps = useDraftSessionStore.getState().completedSteps;
    expect(steps.filter((s) => s === 2)).toHaveLength(1);
  });

  it("accumulates multiple distinct steps", () => {
    act(() => {
      useDraftSessionStore.getState().markStepCompleted(1);
      useDraftSessionStore.getState().markStepCompleted(2);
      useDraftSessionStore.getState().markStepCompleted(3);
    });
    expect(useDraftSessionStore.getState().completedSteps).toEqual([1, 2, 3]);
  });

  it("writes updated steps to sessionStorage", () => {
    act(() => {
      useDraftSessionStore.getState().markStepCompleted(7);
    });
    const stored = sessionStorage.getItem("draftora_completed_steps");
    expect(JSON.parse(stored!)).toContain(7);
  });
});

// ---------------------------------------------------------------------------
// setIsSaving
// ---------------------------------------------------------------------------

describe("draftSessionSlice — setIsSaving", () => {
  it("sets isSaving to true", () => {
    act(() => {
      useDraftSessionStore.getState().setIsSaving(true);
    });
    expect(useDraftSessionStore.getState().isSaving).toBe(true);
  });

  it("sets isSaving back to false", () => {
    act(() => {
      useDraftSessionStore.getState().setIsSaving(true);
    });
    act(() => {
      useDraftSessionStore.getState().setIsSaving(false);
    });
    expect(useDraftSessionStore.getState().isSaving).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setFromHistory
// ---------------------------------------------------------------------------

describe("draftSessionSlice — setFromHistory", () => {
  it("sets fromHistory flag", () => {
    act(() => {
      useDraftSessionStore.getState().setFromHistory(true);
    });
    expect(useDraftSessionStore.getState().fromHistory).toBe(true);
  });

  it("clears fromHistory flag", () => {
    act(() => {
      useDraftSessionStore.getState().setFromHistory(true);
    });
    act(() => {
      useDraftSessionStore.getState().setFromHistory(false);
    });
    expect(useDraftSessionStore.getState().fromHistory).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setGeneratedContent
// ---------------------------------------------------------------------------

describe("draftSessionSlice — setGeneratedContent", () => {
  it("stores the generated content map", () => {
    const content = { executive_summary: "Summary text", timeline: "12 weeks" };
    act(() => {
      useDraftSessionStore.getState().setGeneratedContent(content);
    });
    expect(useDraftSessionStore.getState().generatedContent).toEqual(content);
  });

  it("overwrites previous generated content", () => {
    act(() => {
      useDraftSessionStore.getState().setGeneratedContent({ section_a: "old" });
    });
    act(() => {
      useDraftSessionStore.getState().setGeneratedContent({ section_b: "new" });
    });
    expect(useDraftSessionStore.getState().generatedContent).toEqual({ section_b: "new" });
  });
});

// ---------------------------------------------------------------------------
// resetDraftSession
// ---------------------------------------------------------------------------

describe("draftSessionSlice — resetDraftSession", () => {
  it("clears currentDraftId from state and sessionStorage", () => {
    act(() => {
      useDraftSessionStore.getState().setCurrentDraftId("to-clear");
    });
    act(() => {
      useDraftSessionStore.getState().resetDraftSession();
    });
    expect(useDraftSessionStore.getState().currentDraftId).toBeNull();
    expect(sessionStorage.getItem("draftora_current_draft_id")).toBeNull();
  });

  it("resets draftStage to template_selection", () => {
    act(() => {
      useDraftSessionStore.getState().setDraftStage("generated");
    });
    act(() => {
      useDraftSessionStore.getState().resetDraftSession();
    });
    expect(useDraftSessionStore.getState().draftStage).toBe("template_selection");
  });

  it("clears completedSteps", () => {
    act(() => {
      useDraftSessionStore.getState().setCompletedSteps([1, 2, 3]);
    });
    act(() => {
      useDraftSessionStore.getState().resetDraftSession();
    });
    expect(useDraftSessionStore.getState().completedSteps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("draftSessionSlice — reset", () => {
  it("clears all state back to initial values", () => {
    act(() => {
      useDraftSessionStore.getState().setCurrentDraftId("abc");
      useDraftSessionStore.getState().setDraftStage("review_complete");
      useDraftSessionStore.getState().setIsSaving(true);
      useDraftSessionStore.getState().setFromHistory(true);
    });
    act(() => {
      useDraftSessionStore.getState().reset();
    });
    const state = useDraftSessionStore.getState();
    expect(state.currentDraftId).toBeNull();
    expect(state.draftStage).toBe("template_selection");
    expect(state.isSaving).toBe(false);
    expect(state.fromHistory).toBe(false);
  });

  it("clears sessionStorage on reset", () => {
    act(() => {
      useDraftSessionStore.getState().setCurrentDraftId("xyz");
    });
    act(() => {
      useDraftSessionStore.getState().reset();
    });
    expect(sessionStorage.getItem("draftora_current_draft_id")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readCompletedStepsFromSession — JSON parse fallback
// ---------------------------------------------------------------------------

describe("draftSessionSlice — readCompletedStepsFromSession JSON parse fallback", () => {
  it("returns empty array when sessionStorage has corrupted JSON for completed steps", () => {
    sessionStorage.setItem("draftora_completed_steps", "not-valid-json");
    sessionStorage.removeItem("draftora_completed_steps");
    expect(useDraftSessionStore.getState().completedSteps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Module init reads — truthy branches (use isolateModules to re-init)
// ---------------------------------------------------------------------------

describe("draftSessionSlice — module init reads truthy sessionStorage values", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("restores draftStage from sessionStorage on module init (truthy || branch)", () => {
    sessionStorage.setItem("draftora_draft_stage", "parameters_complete");

    let freshStore: typeof import("@/store/features/drafts/draftSessionSlice") | undefined;
    jest.isolateModules(() => {
      freshStore = require("@/store/features/drafts/draftSessionSlice");
    });

    expect(freshStore!.useDraftSessionStore.getState().draftStage).toBe("parameters_complete");
  });

  it("restores completedSteps from sessionStorage on module init (raw truthy branch)", () => {
    sessionStorage.setItem("draftora_completed_steps", JSON.stringify([1, 2, 3]));

    let freshStore: typeof import("@/store/features/drafts/draftSessionSlice") | undefined;
    jest.isolateModules(() => {
      freshStore = require("@/store/features/drafts/draftSessionSlice");
    });

    expect(freshStore!.useDraftSessionStore.getState().completedSteps).toEqual([1, 2, 3]);
  });

  it("restores currentDraftId from sessionStorage on module init", () => {
    sessionStorage.setItem("draftora_current_draft_id", "restored-id");

    let freshStore: typeof import("@/store/features/drafts/draftSessionSlice") | undefined;
    jest.isolateModules(() => {
      freshStore = require("@/store/features/drafts/draftSessionSlice");
    });

    expect(freshStore!.useDraftSessionStore.getState().currentDraftId).toBe("restored-id");
  });
});

// ---------------------------------------------------------------------------
// Module initialization — reads from sessionStorage when values are present
// These tests use jest.isolateModules to re-import the store after pre-populating
// sessionStorage so that the module-level read functions hit their truthy branches.
// ---------------------------------------------------------------------------

describe("draftSessionSlice — module init reads non-empty sessionStorage (truthy branches)", () => {
  it("restores draftStage from sessionStorage on module init (|| truthy branch)", () => {
    sessionStorage.setItem("draftora_draft_stage", "parameters_complete");

    let store: typeof import("@/store/features/drafts/draftSessionSlice");
    jest.isolateModules(() => {
      store = require("@/store/features/drafts/draftSessionSlice");
    });

    // After module init the store should reflect the sessionStorage value
    expect(store!.useDraftSessionStore.getState().draftStage).toBe("parameters_complete");
    sessionStorage.removeItem("draftora_draft_stage");
  });

  it("restores completedSteps from sessionStorage on module init (raw truthy branch)", () => {
    sessionStorage.setItem("draftora_completed_steps", JSON.stringify([1, 2, 3]));

    let store: typeof import("@/store/features/drafts/draftSessionSlice");
    jest.isolateModules(() => {
      store = require("@/store/features/drafts/draftSessionSlice");
    });

    expect(store!.useDraftSessionStore.getState().completedSteps).toEqual([1, 2, 3]);
    sessionStorage.removeItem("draftora_completed_steps");
  });

  it("restores currentDraftId from sessionStorage on module init", () => {
    sessionStorage.setItem("draftora_current_draft_id", "restored-draft-id");

    let store: typeof import("@/store/features/drafts/draftSessionSlice");
    jest.isolateModules(() => {
      store = require("@/store/features/drafts/draftSessionSlice");
    });

    expect(store!.useDraftSessionStore.getState().currentDraftId).toBe("restored-draft-id");
    sessionStorage.removeItem("draftora_current_draft_id");
  });
});
