/**
 * Tests for useLocalStorage hook
 *
 * Coverage targets:
 *   - Returns initialValue when nothing stored
 *   - Reads existing value from localStorage on init
 *   - setValue stores new value and updates state
 *   - setValue accepts functional updater
 *   - removeValue resets to initialValue and clears localStorage
 *   - Falls back to initialValue on invalid JSON
 */

import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

beforeEach(() => {
  localStorage.clear();
});

describe("useLocalStorage", () => {
  it("returns initialValue when nothing is stored", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", 42));
    expect(result.current[0]).toBe(42);
  });

  it("reads existing value from localStorage on init", () => {
    localStorage.setItem("test-key", JSON.stringify("stored"));
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));
    expect(result.current[0]).toBe("stored");
  });

  it("setValue stores value in localStorage and updates state", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", 0));
    act(() => result.current[1](99));
    expect(result.current[0]).toBe(99);
    expect(JSON.parse(localStorage.getItem("test-key")!)).toBe(99);
  });

  it("setValue accepts a functional updater", () => {
    const { result } = renderHook(() => useLocalStorage("counter", 5));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(6);
    expect(JSON.parse(localStorage.getItem("counter")!)).toBe(6);
  });

  it("removeValue resets to initialValue and clears localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "init"));
    act(() => result.current[1]("changed"));
    act(() => result.current[2]());
    expect(result.current[0]).toBe("init");
    expect(localStorage.getItem("test-key")).toBeNull();
  });

  it("returns initialValue when localStorage has invalid JSON", () => {
    localStorage.setItem("test-key", "{{invalid}}");
    const { result } = renderHook(() => useLocalStorage("test-key", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });

  it("stores object values correctly", () => {
    const { result } = renderHook(() => useLocalStorage("obj-key", { a: 1 }));
    act(() => result.current[1]({ a: 2 }));
    expect(result.current[0]).toEqual({ a: 2 });
    expect(JSON.parse(localStorage.getItem("obj-key")!)).toEqual({ a: 2 });
  });

  it("stores array values correctly", () => {
    const { result } = renderHook(() => useLocalStorage<number[]>("arr-key", []));
    act(() => result.current[1]([1, 2, 3]));
    expect(result.current[0]).toEqual([1, 2, 3]);
  });
});
