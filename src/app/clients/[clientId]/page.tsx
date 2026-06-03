"use client";

import ErrorBoundary from "@/components/common/ErrorBoundary";
import ClientDetailPage from "@/views/clients/ClientDetailPage";

export default function Page(): JSX.Element {
  return (
    <ErrorBoundary>
      <ClientDetailPage />
    </ErrorBoundary>
  );
}
