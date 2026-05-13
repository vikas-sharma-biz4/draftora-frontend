"use client";

import { forwardRef } from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Applies error styling and sets aria-invalid */
  hasError?: boolean;
}

/**
 * Textarea primitive.
 *
 * Wraps the canonical `.textarea` CSS class with error state support.
 * All native textarea attributes are forwarded.
 *
 * @example
 * <Textarea rows={4} placeholder="Describe the project..." hasError={!!errors.desc} />
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError = false, className, ...rest }, ref) => {
    const classes = [
      "textarea",
      hasError ? "input-error" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <textarea
        ref={ref}
        className={classes}
        aria-invalid={hasError || undefined}
        {...rest}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
