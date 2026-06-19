import { HttpError } from "@/config/httpClient";
import { getErrorMessage } from "@/utils/errorUtils";

describe("getErrorMessage", () => {
  it("returns the HttpError message when error is an HttpError", () => {
    const error = new HttpError(404, "Resource not found");
    expect(getErrorMessage(error, "Default fallback")).toBe("Resource not found");
  });

  it("returns the fallback when error is a plain Error", () => {
    expect(getErrorMessage(new Error("generic"), "Default fallback")).toBe("Default fallback");
  });

  it("returns the fallback for non-Error values", () => {
    expect(getErrorMessage("string error", "Default fallback")).toBe("Default fallback");
    expect(getErrorMessage(null, "Default fallback")).toBe("Default fallback");
    expect(getErrorMessage(undefined, "Default fallback")).toBe("Default fallback");
    expect(getErrorMessage(42, "Default fallback")).toBe("Default fallback");
  });

  it("uses the HttpError message even when message is an empty string", () => {
    const error = new HttpError(500, "");
    expect(getErrorMessage(error, "Default fallback")).toBe("");
  });
});
