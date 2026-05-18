"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { BREAKPOINTS, MAIN_NAV_ITEMS } from "@/constants";
import ThemeToggle from "@/components/common/ThemeToggle/ThemeToggle";

const MOBILE_BREAKPOINT = BREAKPOINTS.mobile;

export default function MainSidebar(): JSX.Element {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  function handleToggle(): void {
    if (window.innerWidth <= MOBILE_BREAKPOINT) return;
    setCollapsed((prev) => !prev);
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

      <div className="sidebar-footer">
        <div className="flex-row">
          <ThemeToggle />
          {!collapsed && <span className="text-small text-muted">Theme</span>}
        </div>
      </div>
    </aside>
  );
}
