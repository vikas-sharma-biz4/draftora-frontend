"use client";

import ErrorBoundary from "@/components/common/ErrorBoundary";
import ParametersPage from "@/views/parameters/ParametersPage";

export default function Page(): JSX.Element {
  return (
    <ErrorBoundary>
      <ParametersPage />
    </ErrorBoundary>
  );
}
