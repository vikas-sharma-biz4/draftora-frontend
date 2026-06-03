"use client";

import ErrorBoundary from "@/components/common/ErrorBoundary";
import ClientsPage from "@/views/clients/ClientsPage";

export default function Page(): JSX.Element {
  return (
    <ErrorBoundary>
      <ClientsPage />
    </ErrorBoundary>
  );
}
