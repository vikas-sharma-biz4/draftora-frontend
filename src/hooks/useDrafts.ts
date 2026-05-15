/**
 * Custom hook for accessing draft state
 *
 * Provides automatic data fetching and memoized selectors
 */

import { useEffect, useCallback } from 'react';
import { useDraftStore } from '@/store/features/drafts/draftSlice';
import type { DraftMetadata } from '@/interfaces/draftInterfaces';

interface UseDraftsOptions {
  autoFetch?: boolean;
  force?: boolean;
}

interface UseDraftsReturn {
  drafts: DraftMetadata[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getDraftById: (id: string) => DraftMetadata | undefined;
}

export function useDrafts(options: UseDraftsOptions = {}): UseDraftsReturn {
  const { autoFetch = true, force = false } = options;

  const drafts = useDraftStore(state => state.drafts);
  const isLoading = useDraftStore(state => state.isLoading);
  const error = useDraftStore(state => state.error);
  const fetchDrafts = useDraftStore(state => state.fetchDrafts);
  const getDraftById = (id: string) => useDraftStore(state => state.getDraftById(id));

  useEffect(() => {
    if (autoFetch) {
      fetchDrafts(force);
    }
  }, [autoFetch, force, fetchDrafts]);

  const refetch = useCallback(async () => {
    await fetchDrafts(true);
  }, [fetchDrafts]);

  return {
    drafts,
    isLoading,
    error,
    refetch,
    getDraftById,
  };
}
