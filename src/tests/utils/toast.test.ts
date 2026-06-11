/**
 * Tests for src/utils/toast.ts
 */

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    loading: jest.fn().mockReturnValue("toast-id-123"),
    dismiss: jest.fn(),
    promise: jest.fn(),
  },
}));

import { toast } from "@/utils/toast";
import { toast as sonnerToast } from "sonner";

const mockSonner = sonnerToast as {
  success: jest.Mock;
  error: jest.Mock;
  warning: jest.Mock;
  info: jest.Mock;
  loading: jest.Mock;
  dismiss: jest.Mock;
  promise: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("toast.success", () => {
  it("calls sonnerToast.success with message", () => {
    toast.success("Saved!");
    expect(mockSonner.success).toHaveBeenCalledWith("Saved!", { description: undefined });
  });

  it("calls sonnerToast.success with message and description", () => {
    toast.success("Saved!", "Draft saved successfully");
    expect(mockSonner.success).toHaveBeenCalledWith("Saved!", {
      description: "Draft saved successfully",
    });
  });
});

describe("toast.error", () => {
  it("calls sonnerToast.error with message", () => {
    toast.error("Failed!");
    expect(mockSonner.error).toHaveBeenCalledWith("Failed!", { description: undefined });
  });

  it("calls sonnerToast.error with description", () => {
    toast.error("Failed!", "Please try again");
    expect(mockSonner.error).toHaveBeenCalledWith("Failed!", {
      description: "Please try again",
    });
  });
});

describe("toast.warning", () => {
  it("calls sonnerToast.warning", () => {
    toast.warning("Warning message");
    expect(mockSonner.warning).toHaveBeenCalledWith("Warning message", { description: undefined });
  });
});

describe("toast.info", () => {
  it("calls sonnerToast.info", () => {
    toast.info("Info message");
    expect(mockSonner.info).toHaveBeenCalledWith("Info message", { description: undefined });
  });
});

describe("toast.loading", () => {
  it("calls sonnerToast.loading and returns id", () => {
    const id = toast.loading("Loading...");
    expect(mockSonner.loading).toHaveBeenCalledWith("Loading...");
    expect(id).toBe("toast-id-123");
  });
});

describe("toast.dismiss", () => {
  it("calls sonnerToast.dismiss without id", () => {
    toast.dismiss();
    expect(mockSonner.dismiss).toHaveBeenCalledWith(undefined);
  });

  it("calls sonnerToast.dismiss with id", () => {
    toast.dismiss("my-toast-id");
    expect(mockSonner.dismiss).toHaveBeenCalledWith("my-toast-id");
  });
});

describe("toast.promise", () => {
  it("calls sonnerToast.promise and returns the original promise", async () => {
    const p = Promise.resolve("result");
    const messages = { loading: "Loading", success: "Done", error: "Failed" };
    const returned = toast.promise(p, messages);
    expect(mockSonner.promise).toHaveBeenCalledWith(p, messages);
    await expect(returned).resolves.toBe("result");
  });
});
