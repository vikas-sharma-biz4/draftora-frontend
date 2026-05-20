"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { BREAKPOINTS, MAIN_NAV_ITEMS } from "@/constants";
import { useUIStore } from "@/store/features/ui/uiSlice";

const MOBILE_BREAKPOINT = BREAKPOINTS.mobile;

export default function MainSidebar(): JSX.Element {
  const pathname = usePathname();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  const collapsed = !sidebarOpen;

  function handleToggle(): void {
    if (window.innerWidth <= MOBILE_BREAKPOINT) return;
    toggleSidebar();
  }

  function isActive(path: string): boolean {
    return pathname === path || pathname.startsWith(path + "/");
  }

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <button
        className="sidebar-toggle"
        onClick={handleToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        type="button"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      <div className="sidebar-logo">
        <Link href="/" className="sidebar-logo-btn" aria-label="Go to home" prefetch={false}>
          <img
            src="/images/draftora-logo.png"
            alt="Draftora"
            className="sidebar-logo-img"
          />
        </Link>
      </div>

      <span className="sidebar-section-label">Main Menu</span>

      <ul className="sidebar-steps">
        {MAIN_NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <li key={item.id} className={`sidebar-step-item ${active ? "active" : ""}`}>
              <Link
                href={item.path}
                className="sidebar-nav-link"
                aria-current={active ? "page" : undefined}
                prefetch={false}
              >
                <span className="sidebar-step-indicator">
                  {item.icon}
                </span>
                <span className="sidebar-step-label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

    </aside>
  );
}
