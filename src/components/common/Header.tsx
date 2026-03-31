import Link from "next/link";

import styles from "./Header.module.scss";

interface HeaderProps {
  activeNav?: "dashboard" | "templates" | "archive";
}

export default function Header({ activeNav }: HeaderProps): JSX.Element {
  const navItems = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "templates", label: "Templates", href: "/templates" },
    { key: "archive", label: "Archive", href: "#" },
  ] as const;

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link href="/dashboard" className={styles.logo}>
          Proposely<span className={styles.logoDot}>.</span>
        </Link>
        <nav className={styles.nav}>
          {navItems.map(({ key, label, href }) => (
            <Link
              key={key}
              href={href}
              className={`${styles.navLink} ${activeNav === key ? styles.active : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className={styles.right}>
        <Link href="/" className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Create New
        </Link>
      </div>
    </header>
  );
}
