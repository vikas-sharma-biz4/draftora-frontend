import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export type AlertVariant = "error" | "success" | "warning" | "info";

interface AlertProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  /** Optional dismiss handler — renders a close button when provided */
  onDismiss?: () => void;
  className?: string;
}

const VARIANT_CLASS: Record<AlertVariant, string> = {
  error:   "alert-error",
  success: "alert-success",
  warning: "alert-warning",
  info:    "alert-info",
};

const VARIANT_ICON: Record<AlertVariant, React.ReactNode> = {
  error:   <AlertCircle   size={16} aria-hidden="true" style={{ flexShrink: 0 }} />,
  success: <CheckCircle   size={16} aria-hidden="true" style={{ flexShrink: 0 }} />,
  warning: <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />,
  info:    <Info          size={16} aria-hidden="true" style={{ flexShrink: 0 }} />,
};

/**
 * Alert feedback primitive.
 *
 * Renders a contextual inline message for error, success, warning, or info
 * states. Optionally dismissible.
 *
 * @example
 * <Alert variant="error">Failed to save — please try again.</Alert>
 * <Alert variant="success" onDismiss={() => setVisible(false)}>Saved!</Alert>
 */
export default function Alert({
  variant = "info",
  children,
  onDismiss,
  className,
}: AlertProps): JSX.Element {
  const classes = ["alert", VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role="alert">
      {VARIANT_ICON[variant]}
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            color: "currentColor",
            opacity: 0.6,
            flexShrink: 0,
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
