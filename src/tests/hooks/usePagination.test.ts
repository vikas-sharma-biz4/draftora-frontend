/**
 * Tests for usePagination hook
 *
 * Coverage targets:
 *   - Default initial state
 *   - goToPage clamps to valid range
 *   - nextPage increments page
 *   - prevPage decrements page
 *   - hasPrev / hasNext flags
 *   - setItemsPerPage updates count and resets to page 1
 *   - startIndex / endIndex calculations
 *   - totalPages is at least 1 for 0 items
 */

import { renderHook, act } from "@testing-library/react";
import { usePagination } from "@/hooks/usePagination";

describe("usePagination", () => {
  it("initialises with default values", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }));
    expect(result.current.currentPage).toBe(1);
    expect(result.current.itemsPerPage).toBe(10);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(9);
  });

  it("respects custom initialPage and itemsPerPage", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, itemsPerPage: 20, initialPage: 3 })
    );
    expect(result.current.currentPage).toBe(3);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.startIndex).toBe(40);
    expect(result.current.endIndex).toBe(59);
  });

  it("goToPage navigates to exact page", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }));
    act(() => result.current.goToPage(3));
    expect(result.current.currentPage).toBe(3);
  });

  it("goToPage clamps below 1", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }));
    act(() => result.current.goToPage(0));
    expect(result.current.currentPage).toBe(1);
  });

  it("goToPage clamps above totalPages", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }));
    act(() => result.current.goToPage(100));
    expect(result.current.currentPage).toBe(5);
  });

  it("nextPage increments page", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50 }));
    act(() => result.current.nextPage());
    expect(result.current.currentPage).toBe(2);
    expect(result.current.hasPrev).toBe(true);
    expect(result.current.hasNext).toBe(true);
  });

  it("prevPage decrements page", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50, initialPage: 3 }));
    act(() => result.current.prevPage());
    expect(result.current.currentPage).toBe(2);
  });

  it("hasNext is false on last page", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 50, initialPage: 5 }));
    expect(result.current.hasNext).toBe(false);
    expect(result.current.hasPrev).toBe(true);
  });

  it("setItemsPerPage updates count and resets to page 1", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 100, initialPage: 4 }));
    act(() => result.current.setItemsPerPage(25));
    expect(result.current.itemsPerPage).toBe(25);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(4);
  });

  it("totalPages is at least 1 when totalItems is 0", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 0 }));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(false);
  });

  it("endIndex is capped at totalItems - 1", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 12, initialPage: 2 }));
    // page 2 with 10 items per page: indices 10-11 (only 2 items left)
    expect(result.current.startIndex).toBe(10);
    expect(result.current.endIndex).toBe(11);
  });
});
