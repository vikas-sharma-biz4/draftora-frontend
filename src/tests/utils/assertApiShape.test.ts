/**
 * Tests for src/utils/assertApiShape.ts
 */

jest.mock("@/config/httpClient", () => ({
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.name = "HttpError";
      this.statusCode = statusCode;
    }
  },
}));

import { assertApiShape } from "@/utils/assertApiShape";
import { HttpError } from "@/config/httpClient";

interface SampleShape {
  id: number;
  name: string;
  status: string;
}

const REQUIRED: (keyof SampleShape)[] = ["id", "name", "status"];

describe("assertApiShape", () => {
  it("does not throw when all required fields are present", () => {
    const data = { id: 1, name: "foo", status: "ok" };
    expect(() => assertApiShape<SampleShape>(data, REQUIRED, "[test]")).not.toThrow();
  });

  it("narrows the type — object satisfies T after assertion", () => {
    const data: unknown = { id: 2, name: "bar", status: "active" };
    assertApiShape<SampleShape>(data, REQUIRED, "[test]");
    // TypeScript now allows accessing SampleShape properties on data
    expect(data.id).toBe(2);
  });

  it("throws HttpError(502) when data is null", () => {
    expect(() => assertApiShape<SampleShape>(null, REQUIRED, "[ctx]")).toThrow(HttpError);
    try {
      assertApiShape<SampleShape>(null, REQUIRED, "[ctx]");
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(502);
      expect((err as HttpError).message).toContain("[ctx]");
      expect((err as HttpError).message).toContain("null");
    }
  });

  it("throws HttpError(502) when data is undefined", () => {
    expect(() => assertApiShape<SampleShape>(undefined, REQUIRED, "[ctx]")).toThrow(HttpError);
    try {
      assertApiShape<SampleShape>(undefined, REQUIRED, "[ctx]");
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(502);
      expect((err as HttpError).message).toContain("undefined");
    }
  });

  it("throws HttpError(502) when data is a string", () => {
    expect(() => assertApiShape<SampleShape>("not-an-object", REQUIRED, "[ctx]")).toThrow(
      HttpError
    );
    try {
      assertApiShape<SampleShape>("not-an-object", REQUIRED, "[ctx]");
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(502);
      expect((err as HttpError).message).toContain("string");
    }
  });

  it("throws HttpError(502) when data is a number", () => {
    expect(() => assertApiShape<SampleShape>(42, REQUIRED, "[ctx]")).toThrow(HttpError);
  });

  it("throws HttpError(502) listing the missing field name", () => {
    const data = { id: 1, name: "foo" }; // missing 'status'
    try {
      assertApiShape<SampleShape>(data, REQUIRED, "[ctx]");
      fail("expected throw");
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(502);
      expect((err as HttpError).message).toContain("status");
    }
  });

  it("throws HttpError(502) listing all missing fields when multiple are absent", () => {
    const data = { id: 1 }; // missing 'name' and 'status'
    try {
      assertApiShape<SampleShape>(data, REQUIRED, "[ctx]");
      fail("expected throw");
    } catch (err) {
      expect((err as HttpError).message).toContain("name");
      expect((err as HttpError).message).toContain("status");
    }
  });

  it("includes the context string in every error message", () => {
    const contexts = ["[getProposal]", "[listItems]", "my-service"];
    for (const ctx of contexts) {
      try {
        assertApiShape<SampleShape>(null, REQUIRED, ctx);
      } catch (err) {
        expect((err as HttpError).message).toContain(ctx);
      }
    }
  });

  it("passes when extra fields beyond requiredFields are present", () => {
    const data = { id: 1, name: "x", status: "ok", extra: "bonus" };
    expect(() => assertApiShape<SampleShape>(data, REQUIRED, "[ctx]")).not.toThrow();
  });
});
