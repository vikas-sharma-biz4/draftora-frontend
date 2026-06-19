/**
 * Tests for src/hooks/useSteppedModal.ts
 *
 * Covers:
 *   - initial state (step=1, all booleans false)
 *   - mounted becomes true after render
 *   - Escape key triggers onClose
 *   - other keys do NOT trigger onClose
 *   - listener is removed on unmount
 *   - outside-click closes version dropdown
 *   - click inside [data-version-dropdown] keeps dropdown open
 *   - state setters (setStep, setIsGenerating, setIsSaving)
 *   - body scroll is locked while mounted and restored on unmount
 */

import { act, fireEvent, renderHook } from "@testing-library/react";

import { useSteppedModal } from "@/hooks/useSteppedModal";

const mockOnClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  document.body.style.overflow = "";
});

afterEach(() => {
  document.body.style.overflow = "";
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("useSteppedModal — initial state", () => {
  it("returns step 1 initially", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    expect(result.current.step).toBe(1);
    unmount();
  });

  it("returns showVersionDropdown false initially", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    expect(result.current.showVersionDropdown).toBe(false);
    unmount();
  });

  it("returns isGenerating false initially", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    expect(result.current.isGenerating).toBe(false);
    unmount();
  });

  it("returns isSaving false initially", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    expect(result.current.isSaving).toBe(false);
    unmount();
  });

  it("sets mounted to true after effects run", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    expect(result.current.mounted).toBe(true);
    unmount();
  });
});

// ---------------------------------------------------------------------------
// Escape key
// ---------------------------------------------------------------------------

describe("useSteppedModal — Escape key", () => {
  it("calls onClose when Escape is pressed", () => {
    const { unmount } = renderHook(() => useSteppedModal(mockOnClose));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does not call onClose for other keys", () => {
    const { unmount } = renderHook(() => useSteppedModal(mockOnClose));
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "Tab" });
    expect(mockOnClose).not.toHaveBeenCalled();
    unmount();
  });

  it("removes the keydown listener on unmount", () => {
    const { unmount } = renderHook(() => useSteppedModal(mockOnClose));
    unmount();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Outside-click (version dropdown)
// ---------------------------------------------------------------------------

describe("useSteppedModal — outside-click", () => {
  it("closes version dropdown when clicking an element outside", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    act(() => result.current.setShowVersionDropdown(true));
    expect(result.current.showVersionDropdown).toBe(true);

    const outsideEl = document.createElement("div");
    document.body.appendChild(outsideEl);
    act(() => {
      fireEvent.mouseDown(outsideEl);
    });
    expect(result.current.showVersionDropdown).toBe(false);

    outsideEl.remove();
    unmount();
  });

  it("keeps dropdown open when clicking an element with data-version-dropdown", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    act(() => result.current.setShowVersionDropdown(true));

    const insideEl = document.createElement("div");
    insideEl.setAttribute("data-version-dropdown", "");
    document.body.appendChild(insideEl);
    act(() => {
      fireEvent.mouseDown(insideEl);
    });
    expect(result.current.showVersionDropdown).toBe(true);

    insideEl.remove();
    unmount();
  });

  it("removes the mousedown listener on unmount", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    act(() => result.current.setShowVersionDropdown(true));
    unmount();

    const outsideEl = document.createElement("div");
    document.body.appendChild(outsideEl);
    fireEvent.mouseDown(outsideEl);
    // After unmount the state no longer updates — we just verify no error is thrown
    outsideEl.remove();
  });
});

// ---------------------------------------------------------------------------
// State setters
// ---------------------------------------------------------------------------

describe("useSteppedModal — state setters", () => {
  it("setStep updates step to 2", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    act(() => result.current.setStep(2));
    expect(result.current.step).toBe(2);
    unmount();
  });

  it("setIsGenerating updates isGenerating", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    act(() => result.current.setIsGenerating(true));
    expect(result.current.isGenerating).toBe(true);
    unmount();
  });

  it("setIsSaving updates isSaving", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    act(() => result.current.setIsSaving(true));
    expect(result.current.isSaving).toBe(true);
    unmount();
  });

  it("setShowVersionDropdown toggles with function updater", () => {
    const { result, unmount } = renderHook(() => useSteppedModal(mockOnClose));
    act(() => result.current.setShowVersionDropdown((v) => !v));
    expect(result.current.showVersionDropdown).toBe(true);
    unmount();
  });
});

// ---------------------------------------------------------------------------
// Scroll lock
// ---------------------------------------------------------------------------

describe("useSteppedModal — scroll lock", () => {
  it("locks body scroll when mounted", () => {
    const { unmount } = renderHook(() => useSteppedModal(mockOnClose));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
  });

  it("restores body scroll on unmount", () => {
    const { unmount } = renderHook(() => useSteppedModal(mockOnClose));
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("preserves original overflow value on unmount", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = renderHook(() => useSteppedModal(mockOnClose));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });
});
