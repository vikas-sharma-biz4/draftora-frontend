"use client";

import ErrorBoundary from "@/components/common/ErrorBoundary";
import HistoryPage from "@/views/history/HistoryPage";

export default function Page(): JSX.Element {
  return (
    <ErrorBoundary>
      <HistoryPage />
    </ErrorBoundary>
  );
}
