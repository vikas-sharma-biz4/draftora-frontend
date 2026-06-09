"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FileText, History, PanelLeft } from "lucide-react";

import styles from "./MainSidebar.module.scss";
import { MAIN_NAV_ITEMS, SIDEBAR_LOGO_SRC } from "@/constants";
import { useUIStore } from "@/store/features/ui/uiSlice";

/** Maps nav item id → lucide icon */
const NAV_ICONS: Record<string, React.ReactNode> = {
  home: <Home size={18} />,
  clients: <Users size={18} />,
  drafts: <FileText size={18} />,
  history: <History size={18} />,
};

export default function MainSidebar(): JSX.Element {
  const pathname = usePathname();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const collapsed = !sidebarOpen;

  function isActive(path: string): boolean {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  return (
    <>
      <aside className={styles.sidebar} data-collapsed={collapsed} aria-label="Main navigation">
        {/* ── Header: Logo (left) + Toggle (right) — hidden when collapsed ── */}
        <div className={styles.sidebarHeader}>
          <Link
            href="/"
            className={styles.sidebarLogoLink}
            aria-label="Draftora home"
            prefetch={false}
          >
            <img src={SIDEBAR_LOGO_SRC} alt="Draftora" className={styles.sidebarLogoFull} />
          </Link>

          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeft size={18} />
          </button>
        </div>

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <nav className={styles.sidebarNav}>
          {/* Toggle as first nav item — only visible when collapsed so it
              sits flush with the other icons, no separate header section */}
          <button
            type="button"
            className={styles.sidebarToggleNav}
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <span className={styles.sidebarNavIcon}>
              <PanelLeft size={18} />
            </span>
          </button>

          <ul className={styles.sidebarSteps}>
            {MAIN_NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <li
                  key={item.id}
                  className={`${styles.sidebarStepItem}${active ? ` ${styles.active}` : ""}`}
                >
                  <Link
                    href={item.path}
                    className={styles.sidebarNavLink}
                    aria-current={active ? "page" : undefined}
                    prefetch={false}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className={styles.sidebarNavIcon}>{NAV_ICONS[item.id] ?? item.icon}</span>
                    <span className={styles.sidebarStepLabel}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
