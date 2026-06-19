"use client";

import dynamic from "next/dynamic";

const MainSidebar = dynamic(() => import("@/components/common/MainSidebar"), {
  ssr: false,
  loading: () => <div className="sidebar-skeleton" />,
});

interface AppLayoutProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

/**
 * Standard app page layout: sidebar + scrollable main content area.
 * Replaces the repeated `app-container + MainSidebar + main.main-content` pattern.
 * Use `noPadding` for pages that need the `no-top-padding` variant.
 */
export default function AppLayout({ children, noPadding = false }: AppLayoutProps): JSX.Element {
  return (
    <div className="app-container">
      <MainSidebar />
      <main data-scroll-root className={noPadding ? "main-content no-top-padding" : "main-content"}>
        {children}
      </main>
    </div>
  );
}
