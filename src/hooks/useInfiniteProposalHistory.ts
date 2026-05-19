/**
 * Custom hook for infinite scroll pagination of proposal history
 *
 * Provides automatic loading of more proposals as user scrolls
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProposalListItem } from '@/interfaces/proposalInterfaces';
import * as proposalApi from '@/services/proposal.service';
import { logger } from '@/utils/logger';

interface UseInfiniteProposalHistoryReturn {
  proposals: ProposalListItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  observerRef: (node: HTMLDivElement | null) => void;
}

const PER_PAGE = 20;

export function useInfiniteProposalHistory(): UseInfiniteProposalHistoryReturn {
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(0);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);

  // Fetch initial page
  const fetchInitialPage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      logger.info('[useInfiniteProposalHistory] Fetching initial page');
      const response = await proposalApi.listProposalHistory(1, PER_PAGE);
      
      setProposals(response.items);
      setCurrentPage(1);
      setTotalPages(response.totalPages);
      setHasMore(response.hasMore);
      
      logger.info('[useInfiniteProposalHistory] Initial page loaded', {
        count: response.items.length,
        total: response.total,
        hasMore: response.hasMore,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load proposal history';
      setError(errorMessage);
      logger.error('[useInfiniteProposalHistory] Failed to fetch initial page', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load more proposals
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current || isLoadingMore) {
      return;
    }

    const nextPage = currentPage + 1;
    if (nextPage > totalPages) {
      return;
    }

    loadingRef.current = true;
    setIsLoadingMore(true);
    
    try {
      logger.info('[useInfiniteProposalHistory] Loading more', { page: nextPage });
      const response = await proposalApi.listProposalHistory(nextPage, PER_PAGE);
      
      setProposals(prev => [...prev, ...response.items]);
      setCurrentPage(nextPage);
      setHasMore(response.hasMore);
      
      logger.info('[useInfiniteProposalHistory] More proposals loaded', {
        page: nextPage,
        count: response.items.length,
        totalLoaded: proposals.length + response.items.length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more proposals';
      setError(errorMessage);
      logger.error('[useInfiniteProposalHistory] Failed to load more', err);
    } finally {
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [hasMore, isLoadingMore, currentPage, totalPages, proposals.length]);

  // Refetch from beginning
  const refetch = useCallback(async () => {
    setCurrentPage(1);
    setHasMore(true);
    await fetchInitialPage();
  }, [fetchInitialPage]);

  // Intersection Observer callback for infinite scroll
  const observerCallback = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
        loadMore();
      }
    }, {
      rootMargin: '200px', // Start loading 200px before reaching the bottom
    });

    if (node) {
      observerRef.current.observe(node);
    }
  }, [isLoading, isLoadingMore, hasMore, loadMore]);

  // Initial fetch
  useEffect(() => {
    fetchInitialPage();
  }, [fetchInitialPage]);

  // Cleanup observer
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    proposals,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    observerRef: observerCallback,
  };
}
