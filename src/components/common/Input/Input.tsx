"use client";

import { forwardRef } from "react";

export type InputSize = "sm" | "md" | "lg";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visual size variant */
  inputSize?: InputSize;
  /** Applies error styling and sets aria-invalid */
  hasError?: boolean;
}

const SIZE_CLASS: Record<InputSize, string> = {
  sm: "input-sm",
  md: "",
  lg: "input-lg",
};

/**
 * Input primitive.
 *
 * Wraps the canonical `.input` CSS class with typed size variants and error
 * state. All native input attributes are forwarded.
 *
 * @example
 * <Input placeholder="Enter name" hasError={!!errors.name} />
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = "md", hasError = false, className, ...rest }, ref) => {
    const classes = [
      "input",
      SIZE_CLASS[inputSize],
      hasError ? "input-error" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <input
        ref={ref}
        className={classes}
        aria-invalid={hasError || undefined}
        {...rest}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;
