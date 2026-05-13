export type SpinnerSize = "xs" | "sm" | "md";
export type SpinnerVariant = "default" | "white";

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  /** Accessible label for screen readers. Defaults to "Loading" */
  label?: string;
}

const SIZE_CLASS: Record<SpinnerSize, string> = {
  xs: "spinner-xs",
  sm: "spinner-sm",
  md: "spinner-md",
};

const VARIANT_CLASS: Record<SpinnerVariant, string> = {
  default: "",
  white:   "spinner-white",
};

/**
 * Spinner primitive.
 *
 * Wraps the global `.spinner` CSS class with typed size and variant props.
 * Screen-reader accessible via a visually-hidden label.
 *
 * @example
 * <Spinner size="sm" variant="white" />
 */
export default function Spinner({
  size = "md",
  variant = "default",
  className,
  label = "Loading",
}: SpinnerProps): JSX.Element {
  const classes = [
    "spinner",
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <span className={classes} aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </>
  );
}
