import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import type { ProposalListItem } from "@/interfaces/proposalInterfaces";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock("lucide-react", () => ({
  FileText: () => <span data-testid="icon-file" />,
  Download: () => <span data-testid="icon-download" />,
}));

jest.mock("@/utils/toast", () => ({
  toast: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/services/proposal", () => ({
  getDownloadUrl: (id: number) => `/download/${id}`,
}));

jest.mock("@/components/common/StatusBadge", () => ({
  __esModule: true,
  default: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

jest.mock("@/utils/dateUtils", () => ({
  formatDate: (date: string) => date,
}));

import ProposalCard from "@/components/proposal/ProposalCard";

const baseProposal: ProposalListItem = {
  id: 42,
  title: "Test Proposal",
  clientId: 10,
  clientName: "Acme Corp",
  status: "completed",
  approvalStatus: "approved",
  tone: "professional",
  lengthPreference: "balanced",
  templateType: "predefined",
  createdAt: "2025-03-15T00:00:00Z",
  updatedAt: "2025-03-15T00:00:00Z",
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("ProposalCard — rendering", () => {
  it("renders the proposal title", () => {
    render(<ProposalCard proposal={baseProposal} />);
    expect(screen.getByText("Test Proposal")).toBeInTheDocument();
  });

  it("renders the client name", () => {
    render(<ProposalCard proposal={baseProposal} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders the creation date", () => {
    render(<ProposalCard proposal={baseProposal} />);
    expect(screen.getByText("2025-03-15T00:00:00Z")).toBeInTheDocument();
  });

  it("renders a View link pointing to the proposal detail page", () => {
    render(<ProposalCard proposal={baseProposal} />);
    const link = screen.getByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/proposal/42");
  });

  it("renders the StatusBadge with the proposal's status", () => {
    render(<ProposalCard proposal={baseProposal} />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("completed");
  });
});

// ---------------------------------------------------------------------------
// Download button — visibility
// ---------------------------------------------------------------------------

describe("ProposalCard — download button visibility", () => {
  it("shows the Download button when status is completed", () => {
    render(<ProposalCard proposal={baseProposal} />);
    expect(screen.getByTitle("Download DOCX")).toBeInTheDocument();
  });

  it("hides the Download button when status is draft", () => {
    render(<ProposalCard proposal={{ ...baseProposal, status: "draft" }} />);
    expect(screen.queryByTitle("Download DOCX")).not.toBeInTheDocument();
  });

  it("hides the Download button when status is generating", () => {
    render(<ProposalCard proposal={{ ...baseProposal, status: "generating" }} />);
    expect(screen.queryByTitle("Download DOCX")).not.toBeInTheDocument();
  });

  it("hides the Download button when status is failed", () => {
    render(<ProposalCard proposal={{ ...baseProposal, status: "failed" }} />);
    expect(screen.queryByTitle("Download DOCX")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Download interaction
// ---------------------------------------------------------------------------

describe("ProposalCard — download interaction", () => {
  it("shows a toast and opens the download URL in a new tab when clicked", async () => {
    const user = userEvent.setup();
    const { toast } = require("@/utils/toast") as { toast: { info: jest.Mock } };
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);

    render(<ProposalCard proposal={baseProposal} />);
    await user.click(screen.getByTitle("Download DOCX"));

    expect(toast.info).toHaveBeenCalledWith("Downloading proposal...");
    expect(openSpy).toHaveBeenCalledWith("/download/42", "_blank");

    openSpy.mockRestore();
  });
});
