import { useState, useMemo } from "react";

interface UsePaginationOptions {
  totalItems: number;
  itemsPerPage?: number;
  initialPage?: number;
}

interface UsePaginationReturn {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setItemsPerPage: (count: number) => void;
}

/**
 * Provides client-side pagination logic for any list of items.
 */
export function usePagination({
  totalItems,
  itemsPerPage: initialItemsPerPage = 10,
  initialPage = 1,
}: UsePaginationOptions): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPageState] = useState(initialItemsPerPage);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / itemsPerPage)),
    [totalItems, itemsPerPage]
  );

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage - 1, totalItems - 1);

  const goToPage = (page: number): void => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const setItemsPerPage = (count: number): void => {
    setItemsPerPageState(count);
    setCurrentPage(1);
  };

  return {
    currentPage,
    totalPages,
    itemsPerPage,
    startIndex,
    endIndex,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    goToPage,
    nextPage: () => goToPage(currentPage + 1),
    prevPage: () => goToPage(currentPage - 1),
    setItemsPerPage,
  };
}
