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
