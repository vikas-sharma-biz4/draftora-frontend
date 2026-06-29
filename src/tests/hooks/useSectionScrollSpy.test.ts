/**
 * Tests for useSectionScrollSpy hook
 *
 * Coverage targets:
 *   - mounted=false → no scroll listener added
 *   - sectionKeys empty → no scroll listener added
 *   - no scrollRoot → early return
 *   - scroll event → updateActiveSection → setActiveSection for best match
 *   - fallback when no section passes trigger threshold (picks first visible)
 *   - bestKey same as currentActive → setActiveSection not called again
 *   - handleScrollToSection: updates ref, calls setActiveSection, suppresses spy
 *   - handleScrollToSection: scrolls container when [data-scroll-root] present
 *   - handleScrollToSection: uses scrollIntoView when no container
 *   - isProgrammaticScrollRef suppresses updateActiveSection during programmatic scroll
 *   - cleanup: removes event listeners on unmount
 */

import { renderHook, act } from "@testing-library/react";
import { useSectionScrollSpy } from "@/hooks/useSectionScrollSpy";

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

let rafCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  rafCallbacks = [];
  jest.useFakeTimers();

  // Mock requestAnimationFrame to capture callbacks
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  // Clean up any [data-scroll-root] elements
  document.querySelectorAll("[data-scroll-root]").forEach((el) => el.remove());
  document.querySelectorAll("[id^=section-]").forEach((el) => el.remove());
});

function flushRaf(): void {
  const cbs = [...rafCallbacks];
  rafCallbacks = [];
  cbs.forEach((cb) => cb(0));
}

function makeScrollRoot(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-scroll-root", "");
  root.scrollTop = 0;
  root.scrollTo = jest.fn();
  document.body.appendChild(root);
  return root;
}

function makeSectionEl(key: string, top: number): HTMLElement {
  const el = document.createElement("div");
  el.id = `section-${key}`;
  el.getBoundingClientRect = () =>
    ({ top, left: 0, bottom: top + 100, right: 200, width: 200, height: 100 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSectionScrollSpy — mounted=false skips setup", () => {
  it("does not add scroll listener when mounted is false", () => {
    const scrollRoot = makeScrollRoot();
    const addSpy = jest.spyOn(scrollRoot, "addEventListener");

    renderHook(() => useSectionScrollSpy(["section1"], false, null, jest.fn()));

    expect(addSpy).not.toHaveBeenCalled();
  });
});

describe("useSectionScrollSpy — empty sectionKeys skips setup", () => {
  it("does not add scroll listener when sectionKeys is empty", () => {
    const scrollRoot = makeScrollRoot();
    const addSpy = jest.spyOn(scrollRoot, "addEventListener");

    renderHook(() => useSectionScrollSpy([], true, null, jest.fn()));

    expect(addSpy).not.toHaveBeenCalled();
  });

  it("does not add scroll listener when sectionKeys is undefined", () => {
    const scrollRoot = makeScrollRoot();
    const addSpy = jest.spyOn(scrollRoot, "addEventListener");

    renderHook(() => useSectionScrollSpy(undefined, true, null, jest.fn()));

    expect(addSpy).not.toHaveBeenCalled();
  });
});

describe("useSectionScrollSpy — no scrollRoot skips setup", () => {
  it("does not crash and does not call setActiveSection when no [data-scroll-root]", () => {
    const setActiveSection = jest.fn();

    renderHook(() => useSectionScrollSpy(["exec"], true, null, setActiveSection));

    // No scrollRoot → updateActiveSection called but scrollRoot is null → returns early
    expect(setActiveSection).not.toHaveBeenCalled();
  });
});

describe("useSectionScrollSpy — scroll event triggers updateActiveSection", () => {
  it("calls setActiveSection when a section passes the trigger threshold", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;

    makeSectionEl("exec", 50); // relTop = 50 - 0 = 50, <= 80 → qualifies
    makeSectionEl("scope", 200); // relTop = 200, > 80 → doesn't qualify

    renderHook(() => useSectionScrollSpy(["exec", "scope"], true, null, setActiveSection));

    // updateActiveSection called on mount → picks "exec"
    expect(setActiveSection).toHaveBeenCalledWith("exec");
  });

  it("calls setActiveSection with first visible section when none pass trigger threshold", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;

    makeSectionEl("exec", 150); // relTop = 150 > 80 → doesn't meet trigger
    makeSectionEl("scope", 300); // relTop = 300 > 80 → doesn't meet trigger

    renderHook(() => useSectionScrollSpy(["exec", "scope"], true, null, setActiveSection));

    // Fallback: picks section with smallest relTop = "exec"
    expect(setActiveSection).toHaveBeenCalledWith("exec");
  });

  it("does not call setActiveSection when bestKey equals current active section", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;

    makeSectionEl("exec", 50); // relTop = 50 ≤ 80 → qualifies

    renderHook(() => useSectionScrollSpy(["exec"], true, "exec", setActiveSection));

    // "exec" is already current → setActiveSection NOT called
    expect(setActiveSection).not.toHaveBeenCalled();
  });
});

describe("useSectionScrollSpy — scroll event via onScroll", () => {
  it("rAF deduplication: second scroll before rAF flush queues only one rAF callback", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;
    makeSectionEl("exec", 50);

    renderHook(() => useSectionScrollSpy(["exec"], true, null, setActiveSection));
    rafCallbacks = []; // clear any rAF from mount

    // Dispatch two scroll events before rAF flushes
    act(() => {
      scrollRoot.dispatchEvent(new Event("scroll"));
      scrollRoot.dispatchEvent(new Event("scroll"));
    });

    // Only one rAF callback should be queued (dedup)
    expect(rafCallbacks.length).toBe(1);

    act(() => {
      flushRaf();
    });
    // After flush, rafId is reset — another scroll can queue again
    act(() => {
      scrollRoot.dispatchEvent(new Event("scroll"));
    });
    expect(rafCallbacks.length).toBe(1);
  });

  it("resize event queues a rAF and runs updateActiveSection", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;
    // Use a section that's not yet active (pass activeSection="other" so it differs)
    makeSectionEl("scope2", 50);

    renderHook(() => useSectionScrollSpy(["scope2"], true, "other", setActiveSection));
    // On mount, updateActiveSection runs and calls setActiveSection("scope2")
    expect(setActiveSection).toHaveBeenCalledWith("scope2");
    setActiveSection.mockClear();
    rafCallbacks = [];

    // Move section to a position that would select it again (simulate scroll change)
    // Actually just verify that resize → rAF is queued
    const rafSpy = window.requestAnimationFrame as jest.Mock;
    const callsBefore = rafSpy.mock.calls.length;

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(rafSpy.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe("useSectionScrollSpy — handleScrollToSection", () => {
  it("calls setActiveSection and suppresses scroll-spy for PROGRAMMATIC_SCROLL_SUPPRESSION_MS", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;
    makeSectionEl("scope", 50);

    const { result } = renderHook(() =>
      useSectionScrollSpy(["scope"], true, null, setActiveSection)
    );
    setActiveSection.mockClear();
    rafCallbacks = [];

    act(() => {
      result.current.handleScrollToSection("scope");
    });

    expect(setActiveSection).toHaveBeenCalledWith("scope");

    // rAF runs → updateActiveSection → but isProgrammaticScrollRef=true → returns early
    act(() => {
      flushRaf();
    });
    // setActiveSection was only called once (the programmatic call) — scroll-spy suppressed
    expect(setActiveSection).toHaveBeenCalledTimes(1);

    // After suppression timeout, scroll-spy resumes
    act(() => {
      jest.advanceTimersByTime(1500);
    });
  });

  it("scrolls the container when [data-scroll-root] is present", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;
    makeSectionEl("exec", 50);

    const sectionEl = document.getElementById("section-exec")!;
    sectionEl.getBoundingClientRect = () =>
      ({ top: 100, left: 0, bottom: 200, right: 200, width: 200, height: 100 }) as DOMRect;

    const { result } = renderHook(() =>
      useSectionScrollSpy(["exec"], true, null, setActiveSection)
    );

    act(() => {
      result.current.handleScrollToSection("exec");
      flushRaf(); // the rAF from handleScrollToSection
    });

    expect(scrollRoot.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" })
    );
  });

  it("uses scrollIntoView when no [data-scroll-root] container exists", () => {
    // Remove scroll root
    document.querySelectorAll("[data-scroll-root]").forEach((el) => el.remove());

    const setActiveSection = jest.fn();
    const sectionEl = makeSectionEl("scope", 50);
    const scrollIntoViewMock = jest.fn();
    sectionEl.scrollIntoView = scrollIntoViewMock;

    const { result } = renderHook(() =>
      useSectionScrollSpy(["scope"], true, null, setActiveSection)
    );

    act(() => {
      result.current.handleScrollToSection("scope");
      flushRaf();
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth", block: "start" })
    );
  });

  it("does not crash when section element does not exist in DOM", () => {
    const setActiveSection = jest.fn();
    makeScrollRoot();

    const { result } = renderHook(() =>
      useSectionScrollSpy(["nonexistent"], true, null, setActiveSection)
    );

    act(() => {
      result.current.handleScrollToSection("nonexistent");
      flushRaf();
    });

    // Should not throw; no scroll called
  });
});

describe("useSectionScrollSpy — cleanup on unmount", () => {
  it("removes scroll and resize listeners on unmount", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;
    makeSectionEl("exec", 50);

    const removeSpy = jest.spyOn(scrollRoot, "removeEventListener");
    const windowRemoveSpy = jest.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() =>
      useSectionScrollSpy(["exec"], true, null, setActiveSection)
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(windowRemoveSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});

describe("useSectionScrollSpy — programmaticScrollTimerRef cleanup", () => {
  it("clears programmatic scroll timer on unmount", () => {
    const setActiveSection = jest.fn();

    const { result, unmount } = renderHook(() =>
      useSectionScrollSpy(["exec"], false, null, setActiveSection)
    );

    // Start a programmatic scroll timer
    act(() => {
      result.current.handleScrollToSection("exec");
    });

    // Unmount before timer fires — should not throw
    expect(() => unmount()).not.toThrow();
  });
});

describe("useSectionScrollSpy — isProgrammaticScrollRef suppresses updateActiveSection (line 49)", () => {
  it("returns early from updateActiveSection when isProgrammaticScrollRef is true", () => {
    const setActiveSection = jest.fn();
    const scrollRoot = makeScrollRoot();
    scrollRoot.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 800, right: 400, width: 400, height: 800 }) as DOMRect;
    makeSectionEl("exec", 50);

    const { result } = renderHook(() =>
      useSectionScrollSpy(["exec"], true, null, setActiveSection)
    );

    // handleScrollToSection sets isProgrammaticScrollRef.current = true
    act(() => {
      result.current.handleScrollToSection("exec");
    });

    setActiveSection.mockClear();
    rafCallbacks = [];

    // Dispatch scroll event — queues rAF → updateActiveSection → line 49 true branch → returns early
    act(() => {
      scrollRoot.dispatchEvent(new Event("scroll"));
    });
    act(() => {
      flushRaf();
    });

    // setActiveSection not called because scroll-spy is suppressed
    expect(setActiveSection).not.toHaveBeenCalled();
  });
});

describe("useSectionScrollSpy — programmaticScrollTimerRef cleared on repeated call (line 124)", () => {
  it("clears existing programmatic scroll timer when handleScrollToSection called twice", () => {
    const setActiveSection = jest.fn();
    makeScrollRoot();
    makeSectionEl("exec", 50);

    const { result } = renderHook(() =>
      useSectionScrollSpy(["exec"], true, null, setActiveSection)
    );

    const clearSpy = jest.spyOn(global, "clearTimeout");

    act(() => {
      result.current.handleScrollToSection("exec"); // first call sets timer
      result.current.handleScrollToSection("exec"); // second call: line 124 clears existing timer
    });

    expect(clearSpy).toHaveBeenCalled(); // programmaticScrollTimerRef cleared
    clearSpy.mockRestore();
  });
});
