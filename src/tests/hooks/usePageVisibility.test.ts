/**
 * Tests for usePageVisibility
 *
 * Coverage:
 *   - Fires onVisible when tab becomes visible (document.hidden === false)
 *   - Does NOT fire when tab is hidden (document.hidden === true)
 *   - Always invokes the latest callback without re-registering listeners
 *   - Cleans up the event listener on unmount
 */

import { renderHook } from "@testing-library/react";
import { usePageVisibility } from "@/hooks/usePageVisibility";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", {
    value: hidden,
    configurable: true,
  });
}

function fireVisibilityChange(): void {
  document.dispatchEvent(new Event("visibilitychange"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  setHidden(true); // start with tab hidden so tests control when it "shows"
});

afterEach(() => {
  setHidden(false); // restore default jsdom state
});

describe("usePageVisibility", () => {
  it("calls onVisible when the tab becomes visible", () => {
    const onVisible = jest.fn();
    renderHook(() => usePageVisibility(onVisible));

    setHidden(false);
    fireVisibilityChange();

    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it("does not call onVisible when document.hidden is true", () => {
    const onVisible = jest.fn();
    renderHook(() => usePageVisibility(onVisible));

    setHidden(true);
    fireVisibilityChange();

    expect(onVisible).not.toHaveBeenCalled();
  });

  it("always invokes the latest callback without re-registering the listener", () => {
    const first = jest.fn();
    const second = jest.fn();

    const { rerender } = renderHook(({ fn }: { fn: () => void }) => usePageVisibility(fn), {
      initialProps: { fn: first },
    });

    // Update to a new callback — the underlying listener must not be replaced.
    rerender({ fn: second });

    setHidden(false);
    fireVisibilityChange();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not call onVisible after the hook unmounts", () => {
    const onVisible = jest.fn();
    const { unmount } = renderHook(() => usePageVisibility(onVisible));

    unmount();

    setHidden(false);
    fireVisibilityChange();

    expect(onVisible).not.toHaveBeenCalled();
  });

  it("calls onVisible each time the tab becomes visible", () => {
    const onVisible = jest.fn();
    renderHook(() => usePageVisibility(onVisible));

    setHidden(false);
    fireVisibilityChange();
    setHidden(true);
    fireVisibilityChange();
    setHidden(false);
    fireVisibilityChange();

    expect(onVisible).toHaveBeenCalledTimes(2);
  });
});
