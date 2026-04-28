-- =============================================================================
-- Migration: distributions / distribution_batches / respondents 에 cs_* 링크 컬럼
-- Date:      2026-04-28 (운영 적용 완료, supabase_migrations version=20260428024400)
-- Origin:    survey_sd_changes/supabase/migrations/20260416_distributions_cs_link.sql
-- =============================================================================
-- Why: cs_dashboard 의 확정 대상자(cs_survey_targets) 를 survey_sd 의 distributions
--      에 push 하기 위한 외부 키 + 멱등성 인덱스. 동일 Supabase 프로젝트 공유 전제.
-- 적용 시점: 2026-04-28 운영 DB 직접 적용 (β 워크플로우).
-- =============================================================================

-- Section 1: distributions — cs_target_id / cs_batch_id
ALTER TABLE public.distributions
    ADD COLUMN IF NOT EXISTS cs_target_id uuid,
    ADD COLUMN IF NOT EXISTS cs_batch_id  uuid;

COMMENT ON COLUMN public.distributions.cs_target_id IS
    'cs_survey_targets.id (자연 키). upsert 시 onConflict 키로 사용되어 재발송 시도를 멱등 처리.';
COMMENT ON COLUMN public.distributions.cs_batch_id IS
    'cs_target_batches.id. cs 대시보드 배치 단위 집계(v_cs_dispatch_summary) 용.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_distributions_cs_target
    ON public.distributions (cs_target_id)
    WHERE cs_target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_distributions_cs_batch
    ON public.distributions (cs_batch_id)
    WHERE cs_batch_id IS NOT NULL;

-- Section 2: distribution_batches — cs_batch_id
ALTER TABLE public.distribution_batches
    ADD COLUMN IF NOT EXISTS cs_batch_id uuid;
COMMENT ON COLUMN public.distribution_batches.cs_batch_id IS
    'cs_target_batches.id. bridge API 가 cs 배치 단위로 1건씩 생성하며, 동일 cs_batch_id 재호출 시 기존 batch 재사용.';
CREATE INDEX IF NOT EXISTS idx_dist_batches_cs
    ON public.distribution_batches (cs_batch_id)
    WHERE cs_batch_id IS NOT NULL;

-- Section 3: respondents — cs_contact_id
ALTER TABLE public.respondents
    ADD COLUMN IF NOT EXISTS cs_contact_id uuid;
COMMENT ON COLUMN public.respondents.cs_contact_id IS
    'cs_contacts.id — cs 시스템에서 관리하는 담당자 연락처의 자연 키. respondents 는 survey_sd 의 모든 응답자를 포괄하므로 NULL 허용.';
CREATE UNIQUE INDEX IF NOT EXISTS ux_respondents_cs_contact
    ON public.respondents (cs_contact_id)
    WHERE cs_contact_id IS NOT NULL;
