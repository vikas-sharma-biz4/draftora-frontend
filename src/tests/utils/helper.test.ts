/**
 * Tests for src/utils/helper.ts
 */

import {
  deepClone,
  omit,
  pick,
  isEmpty,
  sleep,
  capitalize,
  truncate,
  uniqueId,
  groupBy,
  sortBy,
  debounce,
} from "@/utils/helper";

// ---------------------------------------------------------------------------
// deepClone
// ---------------------------------------------------------------------------

describe("deepClone", () => {
  it("returns a deep copy of an object", () => {
    const obj = { a: 1, b: { c: 2 } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    expect(clone.b).not.toBe(obj.b);
  });

  it("clones arrays", () => {
    const arr = [1, [2, 3]];
    const clone = deepClone(arr);
    expect(clone).toEqual(arr);
    expect(clone).not.toBe(arr);
  });
});

// ---------------------------------------------------------------------------
// omit
// ---------------------------------------------------------------------------

describe("omit", () => {
  it("omits specified keys", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(omit(obj, ["b"])).toEqual({ a: 1, c: 3 });
  });

  it("returns original object when no keys omitted", () => {
    const obj = { a: 1 };
    expect(omit(obj, [])).toEqual({ a: 1 });
  });

  it("omits multiple keys", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(omit(obj, ["a", "c"])).toEqual({ b: 2 });
  });
});

// ---------------------------------------------------------------------------
// pick
// ---------------------------------------------------------------------------

describe("pick", () => {
  it("picks specified keys", () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  it("returns empty object when no keys picked", () => {
    const obj = { a: 1, b: 2 };
    expect(pick(obj, [])).toEqual({});
  });

  it("ignores keys not in object", () => {
    const obj = { a: 1 };
    expect(pick(obj, ["a" as keyof typeof obj])).toEqual({ a: 1 });
  });
});

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

describe("isEmpty", () => {
  it("returns true for null", () => expect(isEmpty(null)).toBe(true));
  it("returns true for undefined", () => expect(isEmpty(undefined)).toBe(true));
  it("returns true for empty string", () => expect(isEmpty("")).toBe(true));
  it("returns true for whitespace string", () => expect(isEmpty("  ")).toBe(true));
  it("returns true for empty array", () => expect(isEmpty([])).toBe(true));
  it("returns true for empty object", () => expect(isEmpty({})).toBe(true));
  it("returns false for non-empty string", () => expect(isEmpty("hello")).toBe(false));
  it("returns false for non-empty array", () => expect(isEmpty([1])).toBe(false));
  it("returns false for non-empty object", () => expect(isEmpty({ a: 1 })).toBe(false));
  it("returns false for number 0", () => expect(isEmpty(0)).toBe(false));
});

// ---------------------------------------------------------------------------
// sleep
// ---------------------------------------------------------------------------

describe("sleep", () => {
  it("resolves after the given delay", async () => {
    jest.useFakeTimers();
    const p = sleep(100);
    jest.advanceTimersByTime(100);
    await p;
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// capitalize
// ---------------------------------------------------------------------------

describe("capitalize", () => {
  it("capitalizes first letter and lowercases rest", () => {
    expect(capitalize("hELLO")).toBe("Hello");
  });

  it("handles single character", () => {
    expect(capitalize("a")).toBe("A");
  });

  it("handles already capitalized", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe("truncate", () => {
  it("truncates long strings with default suffix", () => {
    expect(truncate("Hello World", 8)).toBe("Hello...");
  });

  it("returns unchanged string when within max length", () => {
    expect(truncate("Hi", 10)).toBe("Hi");
  });

  it("uses custom suffix", () => {
    // suffix "…" has length 1, so slice(0, 7-1) = "Hello " + "…" = "Hello …"
    expect(truncate("Hello World", 7, "…")).toBe("Hello …");
  });

  it("returns string of exactly maxLength", () => {
    expect(truncate("Hello", 5)).toBe("Hello");
  });
});

// ---------------------------------------------------------------------------
// uniqueId
// ---------------------------------------------------------------------------

describe("uniqueId", () => {
  it("generates a unique string", () => {
    const id1 = uniqueId();
    const id2 = uniqueId();
    expect(id1).not.toBe(id2);
  });

  it("includes prefix when provided", () => {
    const id = uniqueId("user_");
    expect(id).toMatch(/^user_/);
  });

  it("generates without prefix by default", () => {
    const id = uniqueId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// groupBy
// ---------------------------------------------------------------------------

describe("groupBy", () => {
  it("groups items by key", () => {
    const items = [
      { type: "a", val: 1 },
      { type: "b", val: 2 },
      { type: "a", val: 3 },
    ];
    const result = groupBy(items, "type");
    expect(result["a"]).toHaveLength(2);
    expect(result["b"]).toHaveLength(1);
  });

  it("returns empty object for empty array", () => {
    expect(groupBy([], "key" as never)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// sortBy
// ---------------------------------------------------------------------------

describe("sortBy", () => {
  const items = [
    { name: "Charlie", age: 30 },
    { name: "Alice", age: 25 },
    { name: "Bob", age: 35 },
  ];

  it("sorts ascending by default", () => {
    const result = sortBy(items, "name");
    expect(result.map((i) => i.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts descending", () => {
    const result = sortBy(items, "age", "desc");
    expect(result.map((i) => i.age)).toEqual([35, 30, 25]);
  });

  it("does not mutate the original array", () => {
    const original = [...items];
    sortBy(items, "name");
    expect(items).toEqual(original);
  });

  it("handles equal values", () => {
    const equal = [{ v: 1 }, { v: 1 }];
    const result = sortBy(equal, "v");
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// debounce
// ---------------------------------------------------------------------------

describe("debounce", () => {
  it("delays function invocation", () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced("a");
    debounced("b");
    debounced("c");

    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");

    jest.useRealTimers();
  });

  it("calls again after delay expires", () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    jest.advanceTimersByTime(100);
    debounced("second");
    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
