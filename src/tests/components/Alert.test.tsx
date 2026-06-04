import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import Alert from "@/components/common/Alert";

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("Alert — rendering", () => {
  it("renders children content", () => {
    render(<Alert>Something went wrong</Alert>);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("has role=alert for screen readers", () => {
    render(<Alert>Message</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("applies the base alert class", () => {
    render(<Alert>Base</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("alert");
  });

  it("defaults to info variant", () => {
    render(<Alert>Info default</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("alert-info");
  });

  it("applies alert-error for error variant", () => {
    render(<Alert variant="error">Error</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("alert-error");
  });

  it("applies alert-success for success variant", () => {
    render(<Alert variant="success">Success</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("alert-success");
  });

  it("applies alert-warning for warning variant", () => {
    render(<Alert variant="warning">Warning</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("alert-warning");
  });

  it("applies alert-info for explicit info variant", () => {
    render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("alert-info");
  });

  it("merges custom className", () => {
    render(<Alert className="extra">Message</Alert>);
    const el = screen.getByRole("alert");
    expect(el).toHaveClass("alert");
    expect(el).toHaveClass("extra");
  });
});

// ---------------------------------------------------------------------------
// Dismiss button
// ---------------------------------------------------------------------------

describe("Alert — dismiss button", () => {
  it("renders a dismiss button when onDismiss is provided", () => {
    render(<Alert onDismiss={jest.fn()}>Message</Alert>);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("does not render a dismiss button when onDismiss is absent", () => {
    render(<Alert>Message</Alert>);
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(<Alert onDismiss={handler}>Message</Alert>);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
