/**
 * Tests for useModalHistory hook
 *
 * Coverage targets:
 *   - Pushes history state when modal opens
 *   - Does not push state again if already pushed
 *   - Calls history.back() when modal closes programmatically
 *   - Calls onClose when popstate fires without modal state
 *   - Removes popstate listener on unmount
 */

import { renderHook } from "@testing-library/react";
import { useModalHistory } from "@/hooks/useModalHistory";

describe("useModalHistory", () => {
  let pushStateSpy: jest.SpyInstance;
  let backSpy: jest.SpyInstance;

  beforeEach(() => {
    pushStateSpy = jest.spyOn(window.history, "pushState").mockImplementation(() => undefined);
    backSpy = jest.spyOn(window.history, "back").mockImplementation(() => undefined);
  });

  afterEach(() => {
    pushStateSpy.mockRestore();
    backSpy.mockRestore();
    jest.clearAllMocks();
  });

  it("pushes history state when modal opens", () => {
    const onClose = jest.fn();
    renderHook(() => useModalHistory({ isOpen: true, onClose, modalId: "test-modal" }));
    expect(pushStateSpy).toHaveBeenCalledWith({ "test-modal": true }, "");
  });

  it("does not push state when modal is closed on mount", () => {
    const onClose = jest.fn();
    renderHook(() => useModalHistory({ isOpen: false, onClose }));
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it("calls history.back() when modal closes programmatically", () => {
    const onClose = jest.fn();
    const { rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useModalHistory({ isOpen, onClose, modalId: "modal" }),
      { initialProps: { isOpen: true } }
    );

    // Modal opened — history state was pushed
    expect(pushStateSpy).toHaveBeenCalledTimes(1);

    // Close programmatically
    rerender({ isOpen: false });
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when popstate fires without modal state", () => {
    const onClose = jest.fn();
    renderHook(() => useModalHistory({ isOpen: true, onClose, modalId: "myModal" }));

    // Simulate browser back button — new state does not contain modal id
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when popstate fires and modal was not open", () => {
    const onClose = jest.fn();
    renderHook(() => useModalHistory({ isOpen: false, onClose, modalId: "myModal" }));

    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes popstate listener on unmount", () => {
    const onClose = jest.fn();
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useModalHistory({ isOpen: true, onClose }));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("popstate", expect.any(Function));
    removeSpy.mockRestore();
  });
});
