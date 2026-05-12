"use client";

import React from "react";

interface BlankLayoutProps {
  children: React.ReactNode;
}

/**
 * Minimal bare layout — renders children with no chrome.
 * Use for error pages, print views, or embedded iframes.
 */
export default function BlankLayout({ children }: BlankLayoutProps): JSX.Element {
  return <>{children}</>;
}
