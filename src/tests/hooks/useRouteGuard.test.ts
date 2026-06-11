/**
 * Tests for useRouteGuard hook
 *
 * Coverage targets:
 *   - Does nothing when enabled=false
 *   - Calls onRouteChange when path changes
 *   - Does not call onRouteChange twice concurrently (isNavigating guard)
 *   - Registers beforeunload listener when blockNavigation=true
 *   - Does not register beforeunload when blockNavigation=false
 *   - Removes beforeunload listener on unmount
 */

import { renderHook } from "@testing-library/react";
import { useRouteGuard } from "@/hooks/useRouteGuard";

// ---------------------------------------------------------------------------
// Navigation mock — keeps the same push fn reference so tests can track calls
// ---------------------------------------------------------------------------

let mockPathname = "/start";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

afterEach(() => {
  mockPathname = "/start";
  jest.clearAllMocks();
});

describe("useRouteGuard — route change detection", () => {
  it("does not call onRouteChange on initial render (same path)", () => {
    const onRouteChange = jest.fn().mockResolvedValue(undefined);
    renderHook(() => useRouteGuard({ enabled: true, onRouteChange }));
    expect(onRouteChange).not.toHaveBeenCalled();
  });

  it("does not call onRouteChange when enabled=false", () => {
    const onRouteChange = jest.fn().mockResolvedValue(undefined);
    mockPathname = "/new-path";
    renderHook(() => useRouteGuard({ enabled: false, onRouteChange }));
    expect(onRouteChange).not.toHaveBeenCalled();
  });

  it("calls onRouteChange when path changes and enabled=true", () => {
    const onRouteChange = jest.fn().mockResolvedValue(undefined);

    // First render with initial path
    mockPathname = "/start";
    const { rerender } = renderHook(() => useRouteGuard({ enabled: true, onRouteChange }));

    // Change the path and re-render
    mockPathname = "/next-page";
    rerender();

    expect(onRouteChange).toHaveBeenCalledTimes(1);
  });
});

describe("useRouteGuard — beforeunload listener", () => {
  it("registers beforeunload listener when blockNavigation=true", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const onRouteChange = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useRouteGuard({ enabled: true, onRouteChange, blockNavigation: true }));

    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("does not register beforeunload when blockNavigation=false", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const onRouteChange = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useRouteGuard({ enabled: true, onRouteChange, blockNavigation: false }));

    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("beforeunload");
    addSpy.mockRestore();
  });

  it("does not register beforeunload when enabled=false", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const onRouteChange = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useRouteGuard({ enabled: false, onRouteChange, blockNavigation: true }));

    const calls = addSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("beforeunload");
    addSpy.mockRestore();
  });

  it("removes beforeunload listener on unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const onRouteChange = jest.fn().mockResolvedValue(undefined);

    const { unmount } = renderHook(() =>
      useRouteGuard({ enabled: true, onRouteChange, blockNavigation: true })
    );
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    removeSpy.mockRestore();
  });
});
