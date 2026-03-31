/**
 * Repository 공통 타입
 */

/** Repository 작업 결과 — 성공 또는 에러를 명시적으로 반환 */
export type RepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

/** 페이지네이션 파라미터 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

/** 페이지네이션 결과 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 정렬 파라미터 */
export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}

/** 공통 필터 */
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}
