/**
 * Data Access Layer — Repository Pattern
 *
 * 남아 있는 Prisma 기반 repository 는 `/api/customers/*` 계열에서만 사용.
 * 실사용 경로 (`/admin/*`, `/s`, `/d`, `/hrd`) 는 Supabase server action 사용.
 */

export { customerRepository } from "./customer.repository";

// 공통 타입
export type { RepositoryResult, PaginationParams, PaginatedResult } from "./types";
