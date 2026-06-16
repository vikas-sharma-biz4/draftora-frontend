/**
 * Tests for usePipelineSteps hook
 *
 * Coverage targets:
 *   - Returns visitedPipelineSteps from store
 *   - highestVisitedStep is null when no steps visited
 *   - highestVisitedStep is max of visited steps
 *   - syncVisitedStepsFromBackend merges backend + local steps
 *   - syncVisitedStepsFromBackend logs error on failure
 *   - markStepVisitedOnBackend calls API and marks step in store
 *   - markStepVisitedOnBackend logs error on failure
 *   - canAccessStep returns result from validateProposalStepAccess
 *   - canAccessStep returns false on error
 *   - resetPipelineSteps calls resetVisitedSteps
 */

import { renderHook, act } from "@testing-library/react";
import { usePipelineSteps } from "@/hooks/usePipelineSteps";
import * as proposalService from "@/services/proposal";
import { usePipelineStore } from "@/store/features/pipeline/pipelineSlice";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/services/proposal", () => ({
  getProposalStatus: jest.fn(),
  markProposalStepVisited: jest.fn(),
  validateProposalStepAccess: jest.fn(),
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetProposalStatus = proposalService.getProposalStatus as jest.Mock;
const mockMarkProposalStepVisited = proposalService.markProposalStepVisited as jest.Mock;
const mockValidateProposalStepAccess = proposalService.validateProposalStepAccess as jest.Mock;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  usePipelineStore.getState().resetVisitedSteps();
});

// ---------------------------------------------------------------------------
// State selectors
// ---------------------------------------------------------------------------

describe("usePipelineSteps — state", () => {
  it("returns empty visitedPipelineSteps initially", () => {
    const { result } = renderHook(() => usePipelineSteps());
    expect(result.current.visitedPipelineSteps).toEqual([]);
  });

  it("highestVisitedStep is null when no steps visited", () => {
    const { result } = renderHook(() => usePipelineSteps());
    expect(result.current.highestVisitedStep).toBeNull();
  });

  it("highestVisitedStep reflects max of visited steps", () => {
    usePipelineStore.getState().setVisitedSteps([1, 3, 2]);
    const { result } = renderHook(() => usePipelineSteps());
    expect(result.current.highestVisitedStep).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// syncVisitedStepsFromBackend
// ---------------------------------------------------------------------------

describe("usePipelineSteps — syncVisitedStepsFromBackend", () => {
  it("merges backend steps with local steps", async () => {
    usePipelineStore.getState().setVisitedSteps([1, 2]);
    mockGetProposalStatus.mockResolvedValue({ visitedPipelineSteps: [2, 3, 4] });

    const { result } = renderHook(() => usePipelineSteps());

    await act(async () => {
      await result.current.syncVisitedStepsFromBackend(10);
    });

    expect(result.current.visitedPipelineSteps).toEqual([1, 2, 3, 4]);
  });

  it("handles missing visitedPipelineSteps in response", async () => {
    usePipelineStore.getState().setVisitedSteps([1]);
    mockGetProposalStatus.mockResolvedValue({});

    const { result } = renderHook(() => usePipelineSteps());

    await act(async () => {
      await result.current.syncVisitedStepsFromBackend(10);
    });

    expect(result.current.visitedPipelineSteps).toEqual([1]);
  });

  it("logs error when API fails", async () => {
    const { logger } = jest.requireMock("@/utils/logger") as { logger: { error: jest.Mock } };
    mockGetProposalStatus.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => usePipelineSteps());

    await act(async () => {
      await result.current.syncVisitedStepsFromBackend(10);
    });

    expect(logger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// markStepVisitedOnBackend
// ---------------------------------------------------------------------------

describe("usePipelineSteps — markStepVisitedOnBackend", () => {
  it("calls API and marks step as visited in store", async () => {
    mockMarkProposalStepVisited.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePipelineSteps());

    await act(async () => {
      await result.current.markStepVisitedOnBackend(10, 3);
    });

    expect(mockMarkProposalStepVisited).toHaveBeenCalledWith(10, 3);
    expect(result.current.visitedPipelineSteps).toContain(3);
  });

  it("logs error when API fails", async () => {
    const { logger } = jest.requireMock("@/utils/logger") as { logger: { error: jest.Mock } };
    mockMarkProposalStepVisited.mockRejectedValue(new Error("500"));

    const { result } = renderHook(() => usePipelineSteps());

    await act(async () => {
      await result.current.markStepVisitedOnBackend(10, 3);
    });

    expect(logger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// canAccessStep
// ---------------------------------------------------------------------------

describe("usePipelineSteps — canAccessStep", () => {
  it("returns true when backend grants access", async () => {
    mockValidateProposalStepAccess.mockResolvedValue(true);

    const { result } = renderHook(() => usePipelineSteps());
    let canAccess: boolean = false;

    await act(async () => {
      canAccess = await result.current.canAccessStep(10, 2);
    });

    expect(canAccess).toBe(true);
    expect(mockValidateProposalStepAccess).toHaveBeenCalledWith(10, 2);
  });

  it("returns false when backend denies access", async () => {
    mockValidateProposalStepAccess.mockResolvedValue(false);

    const { result } = renderHook(() => usePipelineSteps());
    let canAccess: boolean = true;

    await act(async () => {
      canAccess = await result.current.canAccessStep(10, 2);
    });

    expect(canAccess).toBe(false);
  });

  it("returns false on error", async () => {
    mockValidateProposalStepAccess.mockRejectedValue(new Error("403"));

    const { result } = renderHook(() => usePipelineSteps());
    let canAccess: boolean = true;

    await act(async () => {
      canAccess = await result.current.canAccessStep(10, 2);
    });

    expect(canAccess).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resetPipelineSteps
// ---------------------------------------------------------------------------

describe("usePipelineSteps — resetPipelineSteps", () => {
  it("clears all visited steps", () => {
    usePipelineStore.getState().setVisitedSteps([1, 2, 3]);

    const { result } = renderHook(() => usePipelineSteps());

    act(() => {
      result.current.resetPipelineSteps();
    });

    expect(result.current.visitedPipelineSteps).toEqual([]);
    expect(result.current.highestVisitedStep).toBeNull();
  });
});
