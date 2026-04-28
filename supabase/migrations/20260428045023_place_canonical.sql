-- =============================================================================
-- Migration: cs_business_places.bris_place_id canonical key — 정책 문서화
-- Date:      2026-04-21
-- Status:    comment-only (옵션 B, 2026-04-28 결정)
--
-- Context:
--   data_model_v2.md:755-761 원칙("placeId = BRIS canonical unique key") 을
--   스키마 메타데이터에 박제. bris_to_supabase.py:_upsert_place() 의 조회·기록
--   계약을 컬럼 코멘트로 명시한다.
--
--   원래 초안(`cs_master/supabase/migrations/20260421_place_canonical.sql`) 은
--   ① 진단 SELECT, ② 주석 처리된 UNIQUE INDEX, ③ COMMENT 의 3 섹션이었음.
--   2026-04-28 옵션 B 합의에 따라 **③ COMMENT 만** SSOT 로 흡수한다.
--   - ① 진단 SELECT: 마이그레이션 부적합 (운영자가 필요 시 ad-hoc 실행)
--   - ② UNIQUE INDEX: 중복 행 통합 후 별도 PR 로 분리 (현 시점 미적용)
--
-- 멱등성 메모:
--   동일 텍스트의 COMMENT 가 `20260421_add_bris_place_id.sql` 에서 이미 적용됨.
--   본 마이그레이션은 NO-OP 가 됨. 진실원 정합 목적의 baseline retro-register.
-- =============================================================================

comment on column public.cs_business_places.bris_place_id is
  'BRIS 사업장 고유 ID. data_model_v2.md:755-761 canonical key. '
  'bris_to_supabase.py:_upsert_place() 가 조회·기록.';
