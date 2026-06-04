import { renderHook } from "@testing-library/react";

import { useErrorToast } from "@/hooks/useErrorToast";

jest.mock("@/utils/toast", () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
  },
}));

const getToast = () => (require("@/utils/toast") as { toast: { error: jest.Mock } }).toast;

beforeEach(() => jest.clearAllMocks());

describe("useErrorToast — shows toast on truthy error", () => {
  it("calls toast.error with the provided message when error is a non-empty string", () => {
    renderHook(() => useErrorToast("something failed", "Custom error message"));
    expect(getToast().error).toHaveBeenCalledWith("Custom error message");
    expect(getToast().error).toHaveBeenCalledTimes(1);
  });
});

describe("useErrorToast — suppresses toast on falsy error", () => {
  it("does not call toast.error when error is null", () => {
    renderHook(() => useErrorToast(null, "Custom error message"));
    expect(getToast().error).not.toHaveBeenCalled();
  });

  it("does not call toast.error when error is undefined", () => {
    renderHook(() => useErrorToast(undefined, "Custom error message"));
    expect(getToast().error).not.toHaveBeenCalled();
  });

  it("does not call toast.error when error is an empty string", () => {
    renderHook(() => useErrorToast("", "Custom error message"));
    expect(getToast().error).not.toHaveBeenCalled();
  });
});

describe("useErrorToast — reactive re-triggering", () => {
  it("fires again when error changes to a new truthy value", () => {
    const { rerender } = renderHook(
      ({ error }: { error: string | null }) => useErrorToast(error, "Error occurred"),
      { initialProps: { error: null as string | null } }
    );

    expect(getToast().error).not.toHaveBeenCalled();

    rerender({ error: "First error" });
    expect(getToast().error).toHaveBeenCalledTimes(1);

    rerender({ error: "Second error" });
    expect(getToast().error).toHaveBeenCalledTimes(2);
  });

  it("does not re-fire when error stays the same value", () => {
    const { rerender } = renderHook(
      ({ error }: { error: string }) => useErrorToast(error, "Error"),
      { initialProps: { error: "same error" } }
    );

    rerender({ error: "same error" });
    expect(getToast().error).toHaveBeenCalledTimes(1);
  });

  it("stops firing when error changes back to null", () => {
    const { rerender } = renderHook(
      ({ error }: { error: string | null }) => useErrorToast(error, "Error"),
      { initialProps: { error: "initial error" as string | null } }
    );

    expect(getToast().error).toHaveBeenCalledTimes(1);

    rerender({ error: null });
    expect(getToast().error).toHaveBeenCalledTimes(1);
  });
});
