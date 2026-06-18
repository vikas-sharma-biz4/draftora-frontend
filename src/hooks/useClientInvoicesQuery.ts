"use client";

import { useQuery } from "@tanstack/react-query";

import { listArtifacts } from "@/services/artifact.service";
import type { GeneratedArtifact } from "@/interfaces/artifactInterfaces";

export const clientInvoicesQueryKey = (clientId: number): [string, number] => [
  "client-invoices",
  clientId,
];

const STALE_TIME_MS = 60 * 1000;
const GC_TIME_MS = 10 * 60 * 1000;

interface UseClientInvoicesQueryReturn {
  invoices: GeneratedArtifact[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
}

export function useClientInvoicesQuery(clientId: number): UseClientInvoicesQueryReturn {
  const { data, isLoading, isFetching, isError, error } = useQuery<GeneratedArtifact[], Error>({
    queryKey: clientInvoicesQueryKey(clientId),
    queryFn: () => listArtifacts({ clientId, artifactType: "invoice" }),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: true,
    enabled: clientId > 0,
  });

  return {
    invoices: data ?? [],
    isLoading,
    isFetching,
    isError,
    error: error ?? null,
  };
}
