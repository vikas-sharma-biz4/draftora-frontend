import Link from "next/link";

import styles from "./EmptyState.module.scss";

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function EmptyState({
  title = "No proposals yet",
  subtitle = "Create your first AI-generated proposal to get started.",
  ctaLabel = "Create Proposal",
  ctaHref = "/",
}: EmptyStateProps): JSX.Element {
  return (
    <div className={styles.emptyState}>
      <div className={styles.icon}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#eef2ff" />
          <rect x="12" y="14" width="24" height="3" rx="1.5" fill="#c7d2fe" />
          <rect x="12" y="21" width="18" height="3" rx="1.5" fill="#c7d2fe" />
          <rect x="12" y="28" width="14" height="3" rx="1.5" fill="#c7d2fe" />
          <circle cx="35" cy="33" r="7" fill="#3730a3" />
          <rect x="34" y="29.5" width="2" height="7" rx="1" fill="white" />
          <rect x="31.5" y="32" width="7" height="2" rx="1" fill="white" />
        </svg>
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.subtitle}>{subtitle}</p>
      <Link href={ctaHref} className="btn btn-primary">
        {ctaLabel}
      </Link>
    </div>
  );
}
