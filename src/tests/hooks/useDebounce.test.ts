import { renderHook, act } from "@testing-library/react";

import { useDebounce } from "@/hooks/useDebounce";

describe("useDebounce — initial value", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("returns the initial value immediately without delay", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("works with numeric values", () => {
    const { result } = renderHook(() => useDebounce(42, 100));
    expect(result.current).toBe(42);
  });

  it("works with object values", () => {
    const value = { id: 1 };
    const { result } = renderHook(() => useDebounce(value, 100));
    expect(result.current).toBe(value);
  });
});

describe("useDebounce — delay behaviour", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("does not update before the delay elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });

    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe("initial");
  });

  it("updates exactly when the delay elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });

    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe("updated");
  });

  it("uses a default delay of 300 ms", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: "first" },
    });

    rerender({ value: "second" });

    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe("first");

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe("second");
  });
});

describe("useDebounce — cancellation", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("cancels the pending timer when the value changes again before delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    act(() => jest.advanceTimersByTime(200));

    rerender({ value: "c" });
    act(() => jest.advanceTimersByTime(300));

    expect(result.current).toBe("c");
  });

  it("never settles on an intermediate value", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "start" },
    });

    rerender({ value: "middle" });
    act(() => jest.advanceTimersByTime(100));

    rerender({ value: "end" });
    act(() => jest.advanceTimersByTime(300));

    expect(result.current).toBe("end");
    expect(result.current).not.toBe("middle");
  });
});
