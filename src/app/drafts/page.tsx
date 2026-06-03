"use client";

import ErrorBoundary from "@/components/common/ErrorBoundary";
import DraftsPage from "@/views/drafts/DraftsPage";

export default function Page(): JSX.Element {
  return (
    <ErrorBoundary>
      <DraftsPage />
    </ErrorBoundary>
  );
}
