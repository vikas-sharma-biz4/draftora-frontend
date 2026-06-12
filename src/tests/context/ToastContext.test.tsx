/**
 * Tests for src/context/ToastContext.tsx
 */

jest.mock("@/utils/toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    dismiss: jest.fn(),
  },
}));

import React from "react";
import { renderHook } from "@testing-library/react";
import { ToastContextProvider, useToast } from "@/context/ToastContext";
import { toast } from "@/utils/toast";

const mockToast = toast as {
  success: jest.Mock;
  error: jest.Mock;
  warning: jest.Mock;
  info: jest.Mock;
  dismiss: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Provider + useToast
// ---------------------------------------------------------------------------

describe("ToastContextProvider — provides toast functions", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastContextProvider>{children}</ToastContextProvider>
  );

  it("exposes a success function", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current.success).toBe("function");
  });

  it("exposes an error function", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current.error).toBe("function");
  });

  it("exposes a warning function", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current.warning).toBe("function");
  });

  it("exposes an info function", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current.info).toBe("function");
  });

  it("exposes a dismiss function", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current.dismiss).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Delegation to toast util
// ---------------------------------------------------------------------------

describe("useToast — delegates to toast util", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToastContextProvider>{children}</ToastContextProvider>
  );

  it("success() calls toast.success with message and description", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.success("Done!", "All saved");
    expect(mockToast.success).toHaveBeenCalledWith("Done!", "All saved");
  });

  it("success() passes undefined description when omitted", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.success("Done!");
    expect(mockToast.success).toHaveBeenCalledWith("Done!", undefined);
  });

  it("error() calls toast.error", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.error("Failed!", "Try again");
    expect(mockToast.error).toHaveBeenCalledWith("Failed!", "Try again");
  });

  it("warning() calls toast.warning", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.warning("Careful!", undefined);
    expect(mockToast.warning).toHaveBeenCalledWith("Careful!", undefined);
  });

  it("info() calls toast.info", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.info("FYI", undefined);
    expect(mockToast.info).toHaveBeenCalledWith("FYI", undefined);
  });

  it("dismiss() calls toast.dismiss with optional id", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.dismiss("toast-42");
    expect(mockToast.dismiss).toHaveBeenCalledWith("toast-42");
  });

  it("dismiss() calls toast.dismiss without id", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    result.current.dismiss();
    expect(mockToast.dismiss).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// useToast outside provider
// ---------------------------------------------------------------------------

describe("useToast — outside provider", () => {
  it("throws when used without ToastContextProvider", () => {
    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used within ToastContextProvider"
    );
  });
});
