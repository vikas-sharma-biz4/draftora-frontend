import styles from "./PageHeader.module.scss";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

/**
 * Standard page header with title, optional subtitle, and optional action slot.
 * Replaces the repeated title+subtitle+button pattern across all pages.
 */
export default function PageHeader({ title, subtitle, action }: PageHeaderProps): JSX.Element {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.text}>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
