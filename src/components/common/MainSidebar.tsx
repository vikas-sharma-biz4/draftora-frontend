"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

import { MAIN_NAV_ITEMS } from "@/constants";

export default function MainSidebar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  function handleNavClick(path: string): void {
    router.push(path);
  }

  function isActive(path: string): boolean {
    return pathname === path || pathname.startsWith(path + "/");
  }

  return (
    <aside className="sidebar">
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
