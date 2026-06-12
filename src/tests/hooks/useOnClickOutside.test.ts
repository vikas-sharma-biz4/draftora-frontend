/**
 * Tests for useOnClickOutside hook
 *
 * Coverage targets:
 *   - Calls handler on mousedown outside element
 *   - Does not call handler when clicking inside element
 *   - Calls handler on touchstart outside element
 *   - Does not attach listeners when active=false
 *   - Removes listeners on unmount
 */

import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";

describe("useOnClickOutside", () => {
  let div: HTMLDivElement;
  let ref: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    div = document.createElement("div");
    document.body.appendChild(div);
    ref = createRef<HTMLDivElement>();
    (ref as React.MutableRefObject<HTMLDivElement>).current = div;
  });

  afterEach(() => {
    document.body.removeChild(div);
  });

  it("calls handler on mousedown outside element", () => {
    const handler = jest.fn();
    renderHook(() => useOnClickOutside(ref, handler));

    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handler when clicking inside element", () => {
    const handler = jest.fn();
    renderHook(() => useOnClickOutside(ref, handler));

    div.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler on touchstart outside element", () => {
    const handler = jest.fn();
    renderHook(() => useOnClickOutside(ref, handler));

    document.dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not attach listeners when active=false", () => {
    const handler = jest.fn();
    renderHook(() => useOnClickOutside(ref, handler, false));

    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes listeners on unmount", () => {
    const handler = jest.fn();
    const removeSpy = jest.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useOnClickOutside(ref, handler));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));

    removeSpy.mockRestore();
  });

  it("does not call handler when ref.current is null", () => {
    const handler = jest.fn();
    const nullRef = createRef<HTMLDivElement>();
    // ref.current is null by default

    renderHook(() => useOnClickOutside(nullRef, handler));
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });
});
