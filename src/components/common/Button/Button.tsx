"use client";

import { forwardRef } from "react";
import Spinner from "@/components/common/Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "danger-outline"
  | "success"
  | "dark"
  | "outline";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button while true */
  loading?: boolean;
  /** Stretch to full container width */
  fullWidth?: boolean;
  /** Render as icon-only square button */
  iconOnly?: boolean;
  children?: React.ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  "danger-outline": "btn-danger-outline",
  success: "btn-success",
  dark: "btn-dark",
  outline: "btn-secondary",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  xs: "btn-xs",
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

/**
 * Button primitive.
 *
 * Wraps the global `.btn` CSS system with typed variants, sizes, and a
 * built-in loading state. All native button attributes are forwarded.
 *
 * @example
 * <Button variant="primary" size="sm" loading={isSaving} onClick={save}>
 *   Save
 * </Button>
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      iconOnly = false,
      className,
      disabled,
      children,
      ...rest
    },
    ref
  ) => {
    const classes = [
      "btn",
      VARIANT_CLASS[variant],
      SIZE_CLASS[size],
      fullWidth ? "btn-full" : "",
      iconOnly ? "btn-icon" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <span className="btn-loading-content">
            <Spinner size="sm" variant="white" />
            {children && <span>{children}</span>}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
