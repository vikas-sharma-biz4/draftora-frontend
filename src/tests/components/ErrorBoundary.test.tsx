import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

jest.mock("@/utils/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

import ErrorBoundary from "@/components/common/ErrorBoundary";

// Component that throws on demand to trigger the boundary
function Bomb({ shouldThrow }: { shouldThrow: boolean }): JSX.Element {
  if (shouldThrow) throw new Error("Test render error");
  return <div>Healthy content</div>;
}

// Suppress expected React error boundary console.error noise
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Normal rendering
// ---------------------------------------------------------------------------

describe("ErrorBoundary — normal rendering", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state — default fallback
// ---------------------------------------------------------------------------

describe("ErrorBoundary — default fallback UI", () => {
  it("renders the default fallback heading when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders Try Again and Reload Page buttons", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload Page" })).toBeInTheDocument();
  });

  it("logs the error via logger.error", () => {
    const { logger } = require("@/utils/logger") as {
      logger: { error: jest.Mock };
    };
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it("does not render children in the error state", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.queryByText("Healthy content")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state — custom fallback
// ---------------------------------------------------------------------------

describe("ErrorBoundary — custom fallback", () => {
  it("renders the custom fallback instead of the default UI", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error view</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Custom error view")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Recovery — Try Again
// ---------------------------------------------------------------------------

describe("ErrorBoundary — recovery via Try Again", () => {
  it("resets the error state and shows children after Try Again is clicked", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Update children BEFORE triggering the reset so the boundary renders
    // the non-throwing child when state clears.
    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(screen.getByText("Healthy content")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Recovery — Reload Page
// ---------------------------------------------------------------------------

describe("ErrorBoundary — Reload Page", () => {
  it("renders a Reload Page button that is clickable", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadBtn = screen.getByRole("button", { name: "Reload Page" });
    expect(reloadBtn).toBeInTheDocument();
    // Clicking must not throw; actual reload is a side-effect on window.location
    // which jsdom does not support redefining in this environment.
    expect(() => fireEvent.click(reloadBtn)).not.toThrow();
  });
});
