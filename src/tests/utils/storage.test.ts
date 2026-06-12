/**
 * Tests for src/utils/storage.ts
 */

import { storage } from "@/utils/storage";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// storage.get
// ---------------------------------------------------------------------------

describe("storage.get — localStorage", () => {
  it("returns undefined when key does not exist", () => {
    expect(storage.get("missing-key")).toBeUndefined();
  });

  it("returns fallback when key does not exist", () => {
    expect(storage.get("missing-key", "default")).toBe("default");
  });

  it("returns stored value", () => {
    localStorage.setItem("my-key", JSON.stringify({ count: 5 }));
    expect(storage.get<{ count: number }>("my-key")).toEqual({ count: 5 });
  });

  it("returns fallback on JSON parse error", () => {
    localStorage.setItem("bad-json", "not-valid-json");
    expect(storage.get("bad-json", "fallback")).toBe("fallback");
  });
});

describe("storage.get — sessionStorage", () => {
  it("reads from sessionStorage when type='session'", () => {
    sessionStorage.setItem("session-key", JSON.stringify("hello"));
    expect(storage.get<string>("session-key", undefined, "session")).toBe("hello");
  });

  it("returns undefined for missing session key", () => {
    expect(storage.get("session-miss", undefined, "session")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// storage.set
// ---------------------------------------------------------------------------

describe("storage.set — localStorage", () => {
  it("stores a primitive value", () => {
    storage.set("num", 42);
    expect(JSON.parse(localStorage.getItem("num")!)).toBe(42);
  });

  it("stores an object", () => {
    storage.set("obj", { a: 1, b: "two" });
    expect(JSON.parse(localStorage.getItem("obj")!)).toEqual({ a: 1, b: "two" });
  });

  it("stores an array", () => {
    storage.set("arr", [1, 2, 3]);
    expect(JSON.parse(localStorage.getItem("arr")!)).toEqual([1, 2, 3]);
  });
});

describe("storage.set — sessionStorage", () => {
  it("stores to sessionStorage when type='session'", () => {
    storage.set("sess-val", "world", "session");
    expect(JSON.parse(sessionStorage.getItem("sess-val")!)).toBe("world");
  });
});

// ---------------------------------------------------------------------------
// storage.remove
// ---------------------------------------------------------------------------

describe("storage.remove", () => {
  it("removes a key from localStorage", () => {
    storage.set("to-remove", "value");
    storage.remove("to-remove");
    expect(localStorage.getItem("to-remove")).toBeNull();
  });

  it("removes a key from sessionStorage", () => {
    storage.set("sess-remove", "val", "session");
    storage.remove("sess-remove", "session");
    expect(sessionStorage.getItem("sess-remove")).toBeNull();
  });

  it("is a no-op for non-existent key", () => {
    expect(() => storage.remove("non-existent")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// storage.clear
// ---------------------------------------------------------------------------

describe("storage.clear", () => {
  it("clears all localStorage keys", () => {
    storage.set("a", 1);
    storage.set("b", 2);
    storage.clear();
    expect(localStorage.length).toBe(0);
  });

  it("clears sessionStorage when type='session'", () => {
    storage.set("x", 1, "session");
    storage.clear("session");
    expect(sessionStorage.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// storage.has
// ---------------------------------------------------------------------------

describe("storage.has", () => {
  it("returns true when key exists", () => {
    storage.set("exists", true);
    expect(storage.has("exists")).toBe(true);
  });

  it("returns false when key does not exist", () => {
    expect(storage.has("nope")).toBe(false);
  });

  it("checks sessionStorage when type='session'", () => {
    storage.set("sess-exists", "val", "session");
    expect(storage.has("sess-exists", "session")).toBe(true);
  });
});
