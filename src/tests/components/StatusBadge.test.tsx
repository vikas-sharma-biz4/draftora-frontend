import { render, screen } from "@testing-library/react";
import React from "react";

jest.mock("@/components/common/Badge", () => ({
  __esModule: true,
  default: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="icon-loader" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-x" />,
  FileEdit: () => <span data-testid="icon-file" />,
  Clock: () => <span data-testid="icon-clock" />,
}));

import StatusBadge from "@/components/common/StatusBadge";

// ---------------------------------------------------------------------------
// Label rendering
// ---------------------------------------------------------------------------

describe("StatusBadge — label rendering", () => {
  it("renders 'Generating...' for generating status", () => {
    render(<StatusBadge status="generating" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Generating...");
  });

  it("renders 'Complete' for completed status", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Complete");
  });

  it("renders 'Failed' for failed status", () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Failed");
  });

  it("renders 'Draft' for draft status", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Draft");
  });

  it("renders 'Approved' for approved status", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Approved");
  });

  it("renders 'Rejected' for rejected status", () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Rejected");
  });

  it("renders 'Pending Approval' for pending_approval status", () => {
    render(<StatusBadge status="pending_approval" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Pending Approval");
  });

  it("falls back to 'Draft' config for an unknown status string", () => {
    render(<StatusBadge status="totally_unknown_status" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("Draft");
  });
});

// ---------------------------------------------------------------------------
// Variant mapping
// ---------------------------------------------------------------------------

describe("StatusBadge — variant mapping", () => {
  it("uses success variant for completed", () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "success");
  });

  it("uses success variant for approved", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "success");
  });

  it("uses danger variant for failed", () => {
    render(<StatusBadge status="failed" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "danger");
  });

  it("uses danger variant for rejected", () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "danger");
  });

  it("uses warning variant for generating", () => {
    render(<StatusBadge status="generating" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "warning");
  });

  it("uses warning variant for pending_approval", () => {
    render(<StatusBadge status="pending_approval" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "warning");
  });

  it("uses muted variant for draft", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "muted");
  });
});
