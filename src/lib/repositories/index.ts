/**
 * Data Access Layer — Repository Pattern
 *
 * 모든 DB 접근을 이 계층을 통해 수행합니다.
 * - API Routes: Prisma 기반 repository 사용
 * - Server Actions: Supabase 기반 repository 사용 (RLS + cookie auth)
 *
 * 각 repository는 도메인별로 분리되어 있으며,
 * 공통 타입과 에러 처리를 제공합니다.
 */

export { surveyRepository } from "./survey.repository";
export { customerRepository } from "./customer.repository";
export { distributionRepository } from "./distribution.repository";
export { questionRepository } from "./question.repository";

// 공통 타입
export type { RepositoryResult, PaginationParams, PaginatedResult } from "./types";
