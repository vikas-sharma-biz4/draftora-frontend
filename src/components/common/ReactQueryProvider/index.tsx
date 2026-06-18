"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const STALE_TIME_MS = 60 * 1000;
const GC_TIME_MS = 10 * 60 * 1000;

interface ReactQueryProviderProps {
  children: React.ReactNode;
}

export default function ReactQueryProvider({ children }: ReactQueryProviderProps): JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            gcTime: GC_TIME_MS,
            refetchOnWindowFocus: true,
            retry: 2,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
