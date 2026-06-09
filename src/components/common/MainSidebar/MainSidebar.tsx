"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FileText, History, PanelLeft } from "lucide-react";

import styles from "./MainSidebar.module.scss";
import { MAIN_NAV_ITEMS, SIDEBAR_LOGO_SRC } from "@/constants";
import { useUIStore } from "@/store/features/ui/uiSlice";
import { MOBILE_BREAKPOINT } from "@/constants/breakpoints";

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
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  // Detect mobile — initialised synchronously so there's no flash on first render
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  // Keep isMobile in sync on resize
  useEffect(() => {
    const handler = (): void => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const collapsed = !sidebarOpen;

  function isActive(path: string): boolean {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  return (
    <>
      {/* Mobile backdrop — click outside to close */}
      {isMobile && !collapsed && (
        <div
          className={styles.sidebarBackdrop}
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`${styles.sidebar}${isMobile ? ` ${styles.sidebarMobile}` : ""}`}
        data-collapsed={collapsed}
        aria-label="Main navigation"
      >
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
                    onClick={() => isMobile && setSidebarOpen(false)}
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
