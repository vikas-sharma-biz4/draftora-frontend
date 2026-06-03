import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

jest.mock("@/components/common/Spinner", () => ({
  __esModule: true,
  default: () => <span data-testid="spinner" />,
}));

import Button from "@/components/common/Button";

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("Button — rendering", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("always carries the base btn class", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn");
  });

  it("applies btn-primary class by default", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-primary");
  });

  it("applies btn-secondary class for secondary variant", () => {
    render(<Button variant="secondary">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-secondary");
  });

  it("applies btn-danger class for danger variant", () => {
    render(<Button variant="danger">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-danger");
  });

  it("applies btn-ghost class for ghost variant", () => {
    render(<Button variant="ghost">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-ghost");
  });

  it("applies btn-success class for success variant", () => {
    render(<Button variant="success">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-success");
  });

  it("applies btn-sm class for sm size", () => {
    render(<Button size="sm">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-sm");
  });

  it("applies btn-lg class for lg size", () => {
    render(<Button size="lg">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-lg");
  });

  it("applies btn-xs class for xs size", () => {
    render(<Button size="xs">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-xs");
  });

  it("does not add a size class for md (default)", () => {
    render(<Button size="md">Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).not.toMatch(/btn-md/);
  });

  it("applies btn-full when fullWidth is true", () => {
    render(<Button fullWidth>Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-full");
  });

  it("applies btn-icon when iconOnly is true", () => {
    render(<Button iconOnly>Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-icon");
  });

  it("merges a custom className with the generated classes", () => {
    render(<Button className="custom-class">Test</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("btn");
    expect(btn).toHaveClass("custom-class");
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("Button — loading state", () => {
  it("renders the Spinner when loading", () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("is disabled when loading", () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("sets aria-busy to true when loading", () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("does not set aria-busy when not loading", () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("still renders children text alongside the spinner", () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  it("hides the Spinner when not loading", () => {
    render(<Button>Submit</Button>);
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

describe("Button — disabled state", () => {
  it("is disabled when the disabled prop is true", () => {
    render(<Button disabled>Test</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when both disabled and loading are true", () => {
    render(
      <Button disabled loading>
        Test
      </Button>
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

describe("Button — interactions", () => {
  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(<Button onClick={handler}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(
      <Button disabled onClick={handler}>
        Click
      </Button>
    );
    await user.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call onClick when loading", async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(
      <Button loading onClick={handler}>
        Click
      </Button>
    );
    await user.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// forwardRef
// ---------------------------------------------------------------------------

describe("Button — forwardRef", () => {
  it("forwards ref to the underlying button element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
