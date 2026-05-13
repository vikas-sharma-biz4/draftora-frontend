/**
 * Shared generic TypeScript interfaces used across the application
 */

export interface PaginationMeta {
  currentPage:  number;
  totalPages:   number;
  totalItems:   number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data:       T[];
  pagination: PaginationMeta;
}

export type SortOrder = "asc" | "desc";

export interface SortConfig<T> {
  key:   keyof T;
  order: SortOrder;
}

export interface FilterConfig {
  field:     string;
  value:     string | number | boolean;
  operator?: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith";
}

export interface SelectOption<T = string> {
  value:        T;
  label:        string;
  disabled?:    boolean;
  description?: string;
}

export type LoadingStatus = "idle" | "loading" | "succeeded" | "failed";

export interface AsyncState<T> {
  data:   T | null;
  status: LoadingStatus;
  error:  string | null;
}

export interface Entity {
  id:        number;
  createdAt: string;
  updatedAt: string;
}
