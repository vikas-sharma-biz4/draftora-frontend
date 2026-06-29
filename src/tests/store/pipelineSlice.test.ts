/**
 * Tests for src/store/features/pipeline/pipelineSlice.ts
 */

import { usePipelineStore, useVisitedPipelineSteps } from "@/store/features/pipeline/pipelineSlice";
import { renderHook } from "@testing-library/react";

const STORAGE_KEY = "draftora_pipeline_steps";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  usePipelineStore.setState({ visitedSteps: [] });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("pipelineSlice — initial state", () => {
  it("starts with an empty visitedSteps array when localStorage is empty", () => {
    expect(usePipelineStore.getState().visitedSteps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// markStepAsVisited
// ---------------------------------------------------------------------------

describe("pipelineSlice — markStepAsVisited", () => {
  it("adds a step to visitedSteps", () => {
    usePipelineStore.getState().markStepAsVisited(1);
    expect(usePipelineStore.getState().visitedSteps).toContain(1);
  });

  it("does not add duplicates", () => {
    usePipelineStore.getState().markStepAsVisited(1);
    usePipelineStore.getState().markStepAsVisited(1);
    expect(usePipelineStore.getState().visitedSteps).toHaveLength(1);
  });

  it("persists to localStorage", () => {
    usePipelineStore.getState().markStepAsVisited(2);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toContain(2);
  });

  it("accumulates multiple steps", () => {
    usePipelineStore.getState().markStepAsVisited(1);
    usePipelineStore.getState().markStepAsVisited(2);
    usePipelineStore.getState().markStepAsVisited(3);
    expect(usePipelineStore.getState().visitedSteps).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// setVisitedSteps
// ---------------------------------------------------------------------------

describe("pipelineSlice — setVisitedSteps", () => {
  it("replaces visitedSteps with the provided array", () => {
    usePipelineStore.getState().markStepAsVisited(1);
    usePipelineStore.getState().setVisitedSteps([4, 5]);
    expect(usePipelineStore.getState().visitedSteps).toEqual([4, 5]);
  });

  it("persists to localStorage", () => {
    usePipelineStore.getState().setVisitedSteps([10, 20]);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([10, 20]);
  });

  it("accepts an empty array", () => {
    usePipelineStore.getState().setVisitedSteps([]);
    expect(usePipelineStore.getState().visitedSteps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resetVisitedSteps
// ---------------------------------------------------------------------------

describe("pipelineSlice — resetVisitedSteps", () => {
  it("clears all visited steps", () => {
    usePipelineStore.getState().markStepAsVisited(1);
    usePipelineStore.getState().markStepAsVisited(2);
    usePipelineStore.getState().resetVisitedSteps();
    expect(usePipelineStore.getState().visitedSteps).toEqual([]);
  });

  it("clears localStorage", () => {
    usePipelineStore.getState().markStepAsVisited(3);
    usePipelineStore.getState().resetVisitedSteps();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// useVisitedPipelineSteps selector hook
// ---------------------------------------------------------------------------

describe("useVisitedPipelineSteps", () => {
  it("returns current visitedSteps from store", () => {
    usePipelineStore.setState({ visitedSteps: [1, 2, 3] });
    const { result } = renderHook(() => useVisitedPipelineSteps());
    expect(result.current).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// loadFromStorage — branch coverage via jest.isolateModules
// ---------------------------------------------------------------------------

describe("pipelineSlice — loadFromStorage with populated localStorage", () => {
  afterEach(() => {
    localStorage.clear();
    usePipelineStore.setState({ visitedSteps: [] });
  });

  it("loads a valid array from localStorage when data is present (if(stored) true branch)", () => {
    localStorage.setItem("draftora_pipeline_steps", JSON.stringify([3, 4, 5]));

    let visitedSteps: number[] = [];
    jest.isolateModules(() => {
      const mod = require("@/store/features/pipeline/pipelineSlice");
      visitedSteps = mod.INITIAL_PIPELINE_STATE.visitedSteps;
    });

    expect(visitedSteps).toEqual([3, 4, 5]);
  });

  it("returns [] when localStorage has invalid JSON (catch branch)", () => {
    localStorage.setItem("draftora_pipeline_steps", "{{not valid json}}");

    let visitedSteps: number[] = [];
    jest.isolateModules(() => {
      const mod = require("@/store/features/pipeline/pipelineSlice");
      visitedSteps = mod.INITIAL_PIPELINE_STATE.visitedSteps;
    });

    expect(visitedSteps).toEqual([]);
  });

  it("returns [] when parsed value is a non-array object (Array.isArray false branch)", () => {
    localStorage.setItem("draftora_pipeline_steps", JSON.stringify({ a: 1, b: 2 }));

    let visitedSteps: number[] = [];
    jest.isolateModules(() => {
      const mod = require("@/store/features/pipeline/pipelineSlice");
      visitedSteps = mod.INITIAL_PIPELINE_STATE.visitedSteps;
    });

    expect(visitedSteps).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveToStorage — catch branch (localStorage.setItem throws)
// ---------------------------------------------------------------------------

describe("pipelineSlice — saveToStorage catch branch", () => {
  it("does not throw when localStorage.setItem throws (QuotaExceededError)", () => {
    const setItemSpy = jest.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("QuotaExceededError: storage is full");
    });

    expect(() => {
      usePipelineStore.getState().markStepAsVisited(42);
    }).not.toThrow();

    setItemSpy.mockRestore();
  });
});
