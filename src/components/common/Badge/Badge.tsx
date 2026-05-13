export type BadgeVariant = "primary" | "success" | "warning" | "danger" | "muted";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  primary: "badge-primary",
  success: "badge-success",
  warning: "badge-warning",
  danger:  "badge-danger",
  muted:   "badge-muted",
};

/**
 * Generic Badge primitive.
 *
 * Renders a styled pill label using the global `.badge` CSS system.
 * For status-specific badges with icons, use StatusBadge instead.
 *
 * @example
 * <Badge variant="success">Active</Badge>
 * <Badge variant="danger">Expired</Badge>
 */
export default function Badge({
  variant = "primary",
  children,
  className,
}: BadgeProps): JSX.Element {
  const classes = ["badge", VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
