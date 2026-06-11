/**
 * Tests for useMediaQuery hook
 *
 * Coverage targets:
 *   - Returns false when query does not match
 *   - Returns true when query matches
 *   - Updates state when media query changes
 *   - Removes event listener on unmount
 *   - Convenience hooks (useIsMobile, useIsTablet, useIsDesktop) return boolean
 */

import { renderHook, act } from "@testing-library/react";
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from "@/hooks/useMediaQuery";

type ChangeHandler = (e: MediaQueryListEvent) => void;

function createMockMediaQuery(matches: boolean) {
  const handlers: ChangeHandler[] = [];
  const mql = {
    matches,
    addEventListener: jest.fn((_: string, handler: ChangeHandler) => {
      handlers.push(handler);
    }),
    removeEventListener: jest.fn(),
    trigger: (newMatches: boolean) => {
      handlers.forEach((fn) => fn({ matches: newMatches } as MediaQueryListEvent));
    },
  };
  return mql;
}

function installMatchMedia(mock: ReturnType<typeof createMockMediaQuery>): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: jest.fn(() => mock),
  });
}

afterEach(() => {
  jest.clearAllMocks();
});

describe("useMediaQuery", () => {
  it("returns false when query does not match", () => {
    const mock = createMockMediaQuery(false);
    installMatchMedia(mock);

    const { result } = renderHook(() => useMediaQuery("(max-width: 640px)"));
    expect(result.current).toBe(false);
  });

  it("returns true when query matches on mount", () => {
    const mock = createMockMediaQuery(true);
    installMatchMedia(mock);

    const { result } = renderHook(() => useMediaQuery("(max-width: 640px)"));
    expect(result.current).toBe(true);
  });

  it("updates state when media query changes to matching", () => {
    const mock = createMockMediaQuery(false);
    installMatchMedia(mock);

    const { result } = renderHook(() => useMediaQuery("(max-width: 640px)"));
    expect(result.current).toBe(false);

    act(() => mock.trigger(true));
    expect(result.current).toBe(true);
  });

  it("updates state when media query changes to not matching", () => {
    const mock = createMockMediaQuery(true);
    installMatchMedia(mock);

    const { result } = renderHook(() => useMediaQuery("(max-width: 640px)"));
    expect(result.current).toBe(true);

    act(() => mock.trigger(false));
    expect(result.current).toBe(false);
  });

  it("removes event listener on unmount", () => {
    const mock = createMockMediaQuery(false);
    installMatchMedia(mock);

    const { unmount } = renderHook(() => useMediaQuery("(max-width: 640px)"));
    unmount();

    expect(mock.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("adds change event listener on mount", () => {
    const mock = createMockMediaQuery(false);
    installMatchMedia(mock);

    renderHook(() => useMediaQuery("(max-width: 640px)"));
    expect(mock.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});

describe("useIsMobile", () => {
  it("returns a boolean", () => {
    const mock = createMockMediaQuery(true);
    installMatchMedia(mock);

    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe("boolean");
  });
});

describe("useIsTablet", () => {
  it("returns a boolean", () => {
    const mock = createMockMediaQuery(false);
    installMatchMedia(mock);

    const { result } = renderHook(() => useIsTablet());
    expect(typeof result.current).toBe("boolean");
  });
});

describe("useIsDesktop", () => {
  it("returns a boolean", () => {
    const mock = createMockMediaQuery(true);
    installMatchMedia(mock);

    const { result } = renderHook(() => useIsDesktop());
    expect(typeof result.current).toBe("boolean");
  });
});
