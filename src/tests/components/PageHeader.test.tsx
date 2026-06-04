import { render, screen } from "@testing-library/react";
import React from "react";

import PageHeader from "@/components/common/PageHeader";

describe("PageHeader — rendering", () => {
  it("renders the title in a heading element", () => {
    render(<PageHeader title="My Proposals" />);
    expect(screen.getByRole("heading", { name: "My Proposals" })).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(<PageHeader title="Title" subtitle="A helpful subtitle." />);
    expect(screen.getByText("A helpful subtitle.")).toBeInTheDocument();
  });

  it("does not render any subtitle text when subtitle is omitted", () => {
    render(<PageHeader title="Title Only" />);
    expect(screen.queryByText("A helpful subtitle.")).not.toBeInTheDocument();
  });

  it("renders the action slot when provided", () => {
    render(<PageHeader title="Title" action={<button>New Proposal</button>} />);
    expect(screen.getByRole("button", { name: "New Proposal" })).toBeInTheDocument();
  });

  it("renders nothing extra when action slot is omitted", () => {
    render(<PageHeader title="Title" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders both subtitle and action together", () => {
    render(
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your proposals."
        action={<button>Create</button>}
      />
    );
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Overview of your proposals.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});
