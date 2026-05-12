import type { CSSProperties } from "react";

type SkeletonVariant = "text" | "circle" | "badge" | "button" | "block";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Base skeleton shimmer block. Compose these to build page-specific skeletons.
 *
 * @example
 * <Skeleton variant="text" width="70%" height={18} style={{ marginBottom: 8 }} />
 * <Skeleton variant="circle" width={48} height={48} />
 */
export function Skeleton({
  variant,
  width,
  height,
  className,
  style,
}: SkeletonProps): JSX.Element {
  const variantClass = variant ? `skeleton-${variant}` : "";
  const classes = ["skeleton", variantClass, className].filter(Boolean).join(" ");
  return <div className={classes} style={{ width, height, ...style }} />;
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="proposal-card skeleton-card">
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%", marginBottom: 16 }} />
      <div className="skeleton" style={{ width: "70%", height: 18, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: "50%", height: 14, marginBottom: 20 }} />
      <div className="skeleton" style={{ width: "40%", height: 22, borderRadius: 99 }} />
    </div>
  );
}

export function SkeletonSection(): JSX.Element {
  return (
    <div className="section-card">
      <div className="skeleton" style={{ width: "40%", height: 22, marginBottom: 16 }} />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text" style={{ width: "90%" }} />
      <div className="skeleton skeleton-text" style={{ width: "80%" }} />
    </div>
  );
}
