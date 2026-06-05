import Link from "next/link";

import styles from "./EmptyState.module.scss";
import Button from "@/components/common/Button";

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title = "No proposals yet",
  subtitle = "Create your first AI-generated proposal to get started.",
  ctaLabel,
  ctaHref,
  onCtaClick,
  icon,
}: EmptyStateProps): JSX.Element {
  const defaultIcon = (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="var(--color-primary-light)" />
      <rect x="12" y="14" width="24" height="3" rx="1.5" fill="var(--color-primary-medium)" />
      <rect x="12" y="21" width="18" height="3" rx="1.5" fill="var(--color-primary-medium)" />
      <rect x="12" y="28" width="14" height="3" rx="1.5" fill="var(--color-primary-medium)" />
      <circle cx="35" cy="33" r="7" fill="var(--color-primary)" />
      <rect x="34" y="29.5" width="2" height="7" rx="1" fill="var(--color-white)" />
      <rect x="31.5" y="32" width="7" height="2" rx="1" fill="var(--color-white)" />
    </svg>
  );

  const showCta = ctaLabel && (ctaHref || onCtaClick);

  return (
    <div className={styles.emptyState} data-testid="empty-state">
      <div className={styles.icon}>{icon ?? defaultIcon}</div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.subtitle}>{subtitle}</p>
      {showCta &&
        (onCtaClick ? (
          <Button variant="primary" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        ) : (
          <Link href={ctaHref!}>
            <Button variant="primary">{ctaLabel}</Button>
          </Link>
        ))}
    </div>
  );
}
