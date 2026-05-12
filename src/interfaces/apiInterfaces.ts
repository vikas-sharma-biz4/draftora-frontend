/**
 * HTTP request / response base types
 *
 * These mirror the backend API envelope and serve as the
 * foundation for all service-layer types.
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data:    T;
  message?: string;
}

export interface ApiErrorPayload {
  code:     string;
  message:  string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error:   ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  params?:  Record<string, string | number | boolean>;
  timeout?: number;
}

export enum HttpStatus {
  OK           = 200,
  CREATED      = 201,
  NO_CONTENT   = 204,
  BAD_REQUEST  = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN    = 403,
  NOT_FOUND    = 404,
  CONFLICT     = 409,
  UNPROCESSABLE = 422,
  SERVER_ERROR  = 500,
}

export interface ListQueryParams {
  page?:   number;
  limit?:  number;
  search?: string;
  sortBy?: string;
  order?:  "asc" | "desc";
}
