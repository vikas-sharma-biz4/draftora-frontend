"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FileText, History, PanelLeft } from "lucide-react";

import { MAIN_NAV_ITEMS } from "@/constants";
import { useUIStore } from "@/store/features/ui/uiSlice";

const MOBILE_BREAKPOINT = 768;

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
    const handler = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const collapsed = !sidebarOpen;

  function handleToggle(): void {
    toggleSidebar();
  }

  function isActive(path: string): boolean {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  }

  return (
    <>
      {/* Mobile backdrop — click outside to close */}
      {isMobile && !collapsed && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`sidebar${collapsed ? " collapsed" : ""}${isMobile ? " sidebar-mobile" : ""}`}
        aria-label="Main navigation"
      >
        {/* ── Header: Logo (left) + Toggle (right) — hidden when collapsed ─ */}
        <div className="sidebar-header">
          <Link
            href="/"
            className="sidebar-logo-link"
            aria-label="Draftora home"
            prefetch={false}
          >
            <img
              src="/images/draftora-logo.png"
              alt="Draftora"
              className="sidebar-logo-full"
            />
          </Link>

          <button
            type="button"
            className="sidebar-toggle sidebar-toggle-header"
            onClick={handleToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeft size={18} />
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <nav className="sidebar-nav">
          {/* Toggle as first nav item — only visible when collapsed so it
              sits flush with the other icons, no separate header section */}
          <button
            type="button"
            className="sidebar-toggle-nav"
            onClick={handleToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <span className="sidebar-nav-icon"><PanelLeft size={18} /></span>
          </button>

          <ul className="sidebar-steps">
            {MAIN_NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <li
                  key={item.id}
                  className={`sidebar-step-item${active ? " active" : ""}`}
                >
                  <Link
                    href={item.path}
                    className="sidebar-nav-link"
                    aria-current={active ? "page" : undefined}
                    prefetch={false}
                    title={collapsed ? item.label : undefined}
                    onClick={() => isMobile && setSidebarOpen(false)}
                  >
                    <span className="sidebar-nav-icon">
                      {NAV_ICONS[item.id] ?? item.icon}
                    </span>
                    <span className="sidebar-step-label">{item.label}</span>
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
