import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ProposalSearch } from "@/components/dashboard/ProposalSearch";

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("ProposalSearch — rendering", () => {
  it("renders a text input", () => {
    render(<ProposalSearch value="" onChange={jest.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("displays the controlled value", () => {
    render(<ProposalSearch value="hello" onChange={jest.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("hello");
  });

  it("shows the default placeholder text", () => {
    render(<ProposalSearch value="" onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText("Search by title or client...")).toBeInTheDocument();
  });

  it("shows a custom placeholder when provided", () => {
    render(<ProposalSearch value="" onChange={jest.fn()} placeholder="Type to search" />);
    expect(screen.getByPlaceholderText("Type to search")).toBeInTheDocument();
  });

  it("applies a custom className to the input", () => {
    render(<ProposalSearch value="" onChange={jest.fn()} className="my-search" />);
    expect(screen.getByRole("textbox")).toHaveClass("my-search");
  });
});

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

describe("ProposalSearch — interactions", () => {
  it("calls onChange with the typed character each keystroke", async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(<ProposalSearch value="" onChange={handler} />);
    await user.type(screen.getByRole("textbox"), "ab");
    expect(handler).toHaveBeenCalledWith("a");
    expect(handler).toHaveBeenCalledWith("b");
  });

  it("calls onChange once per character", async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(<ProposalSearch value="" onChange={handler} />);
    await user.type(screen.getByRole("textbox"), "xyz");
    expect(handler).toHaveBeenCalledTimes(3);
  });
});
