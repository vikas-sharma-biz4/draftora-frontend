/**
 * Tests for src/hooks/useBodyScrollLock.ts
 */

import { renderHook } from "@testing-library/react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset body overflow before each test
  document.body.style.overflow = "";
});

// ---------------------------------------------------------------------------
// Single lock
// ---------------------------------------------------------------------------

describe("useBodyScrollLock — single active lock", () => {
  it("sets body overflow to 'hidden' when active=true", () => {
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
  });

  it("defaults active to true and locks scroll", () => {
    const { unmount } = renderHook(() => useBodyScrollLock());
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
  });

  it("does not modify overflow when active=false", () => {
    const { unmount } = renderHook(() => useBodyScrollLock(false));
    expect(document.body.style.overflow).toBe("");
    unmount();
  });
});

// ---------------------------------------------------------------------------
// Cleanup / restore on unmount
// ---------------------------------------------------------------------------

describe("useBodyScrollLock — restore on unmount", () => {
  it("restores empty overflow on unmount", () => {
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("restores previous overflow value on unmount", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("does not affect overflow on unmount when active=false", () => {
    document.body.style.overflow = "auto";
    const { unmount } = renderHook(() => useBodyScrollLock(false));
    unmount();
    expect(document.body.style.overflow).toBe("auto");
    // Cleanup for next test
    document.body.style.overflow = "";
  });
});

// ---------------------------------------------------------------------------
// Multiple concurrent locks (reference counting)
// ---------------------------------------------------------------------------

describe("useBodyScrollLock — multiple concurrent locks", () => {
  it("keeps overflow hidden while any lock is active", () => {
    const { unmount: u1 } = renderHook(() => useBodyScrollLock(true));
    const { unmount: u2 } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe("hidden");
    u1();
    expect(document.body.style.overflow).toBe("hidden"); // still locked by u2
    u2();
    expect(document.body.style.overflow).toBe(""); // fully unlocked
  });
});
