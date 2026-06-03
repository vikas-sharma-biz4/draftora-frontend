import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/components/common/Button", () => ({
  __esModule: true,
  default: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import EmptyState from "@/components/common/EmptyState";

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

describe("EmptyState — default rendering", () => {
  it("renders the default title", () => {
    render(<EmptyState />);
    expect(screen.getByText("No proposals yet")).toBeInTheDocument();
  });

  it("renders the default subtitle", () => {
    render(<EmptyState />);
    expect(
      screen.getByText("Create your first AI-generated proposal to get started.")
    ).toBeInTheDocument();
  });

  it("does not render a CTA when ctaLabel is absent", () => {
    render(<EmptyState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Custom props
// ---------------------------------------------------------------------------

describe("EmptyState — custom props", () => {
  it("renders a custom title", () => {
    render(<EmptyState title="No clients found" />);
    expect(screen.getByText("No clients found")).toBeInTheDocument();
  });

  it("renders a custom subtitle", () => {
    render(<EmptyState subtitle="Try a different search term." />);
    expect(screen.getByText("Try a different search term.")).toBeInTheDocument();
  });

  it("renders a custom icon when provided", () => {
    render(<EmptyState icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CTA — link variant
// ---------------------------------------------------------------------------

describe("EmptyState — CTA (link)", () => {
  it("renders a link CTA when ctaLabel and ctaHref are provided", () => {
    render(<EmptyState ctaLabel="Create Proposal" ctaHref="/new" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/new");
    expect(screen.getByText("Create Proposal")).toBeInTheDocument();
  });

  it("does not render an onClick button when only ctaHref is given", () => {
    render(<EmptyState ctaLabel="Go" ctaHref="/somewhere" />);
    const btn = screen.getByRole("button");
    expect(btn).not.toHaveAttribute("onClick");
  });
});

// ---------------------------------------------------------------------------
// CTA — onClick variant
// ---------------------------------------------------------------------------

describe("EmptyState — CTA (onClick)", () => {
  it("renders a button CTA when onCtaClick is provided", () => {
    render(<EmptyState ctaLabel="Retry" onCtaClick={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("does not render a link when onCtaClick is provided", () => {
    render(<EmptyState ctaLabel="Retry" onCtaClick={jest.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onCtaClick when the button is clicked", async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(<EmptyState ctaLabel="Retry" onCtaClick={handler} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not show CTA when ctaLabel is absent even if onCtaClick is provided", () => {
    render(<EmptyState onCtaClick={jest.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
