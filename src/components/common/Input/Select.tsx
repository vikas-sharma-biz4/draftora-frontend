"use client";

import { forwardRef } from "react";

import type { InputSize } from "./Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
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
 * Select primitive.
 *
 * Wraps the canonical `.select` CSS class with typed size variants and error
 * state. All native select attributes are forwarded.
 *
 * @example
 * <Select hasError={!!errors.tone}>
 *   <option value="">Select tone...</option>
 *   <option value="formal">Formal</option>
 * </Select>
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ inputSize = "md", hasError = false, className, children, ...rest }, ref) => {
    const classes = [
      "select",
      SIZE_CLASS[inputSize],
      hasError ? "input-error" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <select
        ref={ref}
        className={classes}
        aria-invalid={hasError || undefined}
        {...rest}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

export default Select;
