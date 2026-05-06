"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MAIN_NAV_ITEMS } from "@/constants";

export default function MainSidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const MOBILE_BREAKPOINT = 640;
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleToggle(): void {
    if (window.innerWidth <= MOBILE_BREAKPOINT) return;
    setCollapsed((prev) => !prev);
  }

  function handleNavClick(path: string): void {
    router.push(path);
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
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
      <div className="sidebar-logo">
        <button
          className="sidebar-logo-btn"
          onClick={() => router.push("/")}
          aria-label="Go to home"
        >
          <img
            src="/images/draftora-logo.png"
            alt="Draftora"
            className="sidebar-logo-img"
          />
        </button>
      </div>

      <span className="sidebar-section-label">Main Menu</span>

      <ul className="sidebar-steps">
        {MAIN_NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <li
              key={item.id}
              className={`sidebar-step-item ${active ? "active" : ""}`}
              onClick={() => handleNavClick(item.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNavClick(item.path);
              }}
            >
              <span className="sidebar-step-indicator">
                {item.icon}
              </span>
              <span className="sidebar-step-label">{item.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="sidebar-footer">
        <button
          className="btn btn-primary btn-sm btn-full"
          onClick={() => router.push("/")}
        >
          + New Proposal
        </button>
      </div>
    </aside>
  );
}
