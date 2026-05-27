/**
 * Tests for ConfirmModal component
 *
 * Coverage targets:
 *   - Renders when isOpen is true
 *   - Does not render when isOpen is false
 *   - Calls onConfirm on confirm click
 *   - Calls onCancel on cancel click
 *   - Shows loading state during async onConfirm
 *   - Swallows errors from async onConfirm (logs instead of crashing)
 *   - Disables cancel button while confirming
 *   - Renders custom title when provided
 *   - Uses default title "Confirm" when title not provided
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import ConfirmModal from "@/components/common/ConfirmModal/ConfirmModal";

// Mock toast and messages for the error feedback path
jest.mock("@/utils/toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock("@/constants/messages", () => ({
  MESSAGES: {
    GENERIC_ERROR: "Something went wrong. Please try again.",
  },
}));

// Mock BaseModal to simplify test — just renders children when isOpen
jest.mock("@/components/common/BaseModal", () => {
  return function MockBaseModal({
    isOpen,
    children,
    onClose,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    onClose: () => void;
  }): JSX.Element | null {
    if (!isOpen) return null;
    return <div data-testid="base-modal">{children}</div>;
  };
});

// Mock Button to avoid style imports
jest.mock("@/components/common/Button", () => {
  return function MockButton({
    onClick,
    children,
    disabled,
    loading,
    variant,
  }: {
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    variant?: string;
  }): JSX.Element {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        data-loading={loading ? "true" : "false"}
        data-variant={variant}
      >
        {children}
      </button>
    );
  }
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("ConfirmModal — rendering", () => {
  const defaultProps = {
    isOpen: true,
    message: "Are you sure?",
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  it("renders when isOpen is true", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByTestId("base-modal")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId("base-modal")).not.toBeInTheDocument();
  });

  it("displays the message", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("displays custom title when provided", () => {
    render(<ConfirmModal {...defaultProps} title="Delete Proposal" />);
    expect(screen.getByText("Delete Proposal")).toBeInTheDocument();
  });

  it("renders default title 'Confirm' when title prop not provided", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Confirm");
  });

  it("renders Cancel and Confirm buttons", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

describe("ConfirmModal — interactions", () => {
  const defaultProps = {
    isOpen: true,
    message: "Are you sure?",
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Confirm button is clicked", () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows loading state on Confirm button during async onConfirm", async () => {
    let resolvePromise: () => void;
    const asyncOnConfirm = jest.fn(
      () => new Promise<void>((resolve) => { resolvePromise = resolve; })
    );

    render(<ConfirmModal {...defaultProps} onConfirm={asyncOnConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    expect(confirmBtn.dataset.loading).toBe("true");

    // Resolve the promise
    resolvePromise!();
    await waitFor(() => {
      expect(confirmBtn.dataset.loading).toBe("false");
    });
  });

  it("disables Cancel button while confirming", async () => {
    let resolvePromise: () => void;
    const asyncOnConfirm = jest.fn(
      () => new Promise<void>((resolve) => { resolvePromise = resolve; })
    );

    render(<ConfirmModal {...defaultProps} onConfirm={asyncOnConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    const cancelBtn = screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);

    resolvePromise!();
    await waitFor(() => {
      expect(cancelBtn.disabled).toBe(false);
    });
  });

  it("shows toast.error when onConfirm rejects", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { toast } = require("@/utils/toast");
    const errorOnConfirm = jest.fn(() =>
      Promise.reject(new Error("Something went wrong"))
    );

    render(<ConfirmModal {...defaultProps} onConfirm={errorOnConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.");
    });
  });

  it("resets loading state after onConfirm error", async () => {
    const errorOnConfirm = jest.fn(() =>
      Promise.reject(new Error("fail"))
    );

    render(<ConfirmModal {...defaultProps} onConfirm={errorOnConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    await waitFor(() => {
      expect(confirmBtn.dataset.loading).toBe("false");
    });
  });
});
