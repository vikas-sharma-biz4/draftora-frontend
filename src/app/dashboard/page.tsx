"use client";

import ErrorBoundary from "@/components/common/ErrorBoundary";
import DashboardPage from "@/views/dashboard/DashboardPage";

export default function Page(): JSX.Element {
  return (
    <ErrorBoundary>
      <DashboardPage />
    </ErrorBoundary>
  );
}
