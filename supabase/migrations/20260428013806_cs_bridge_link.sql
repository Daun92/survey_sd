-- =============================================================================
-- Migration: cs_dashboard ↔ survey_sd 연동을 위한 cs_survey_targets 컬럼 확장
-- Date:      2026-04-28 (운영 적용 완료, supabase_migrations version=20260428013806)
-- Origin:    cs_master/supabase/migrations/20260416_cs_bridge_link.sql
-- =============================================================================
-- Why: cs_dashboard.html Step 5 발송이 survey_sd 브릿지로 push 한 결과(distribution_id,
--      survey_url 등)를 cs_survey_targets 에 writeback 하기 위한 컬럼/인덱스/RLS.
-- 적용 시점: 2026-04-28 운영 DB 직접 적용 (β 워크플로우, branch 무력화로 인한 폴백).
-- =============================================================================

ALTER TABLE IF EXISTS public.cs_survey_targets
    ADD COLUMN IF NOT EXISTS distribution_id   uuid,
    ADD COLUMN IF NOT EXISTS survey_token      text,
    ADD COLUMN IF NOT EXISTS survey_url        text,
    ADD COLUMN IF NOT EXISTS dispatched_at     timestamptz,
    ADD COLUMN IF NOT EXISTS dispatch_channel  text,
    ADD COLUMN IF NOT EXISTS dispatch_error    text;

COMMENT ON COLUMN public.cs_survey_targets.distribution_id IS
    'survey_sd.distributions.id 와의 외부 링크 (동일 Supabase 프로젝트 공유).';
COMMENT ON COLUMN public.cs_survey_targets.survey_token IS
    'distributions.unique_token 사본 — 이메일/SMS 발송 링크에 사용되는 32-hex 토큰.';
COMMENT ON COLUMN public.cs_survey_targets.survey_url IS
    '전체 응답 URL (예: https://exc-survey.vercel.app/s/{token}).';
COMMENT ON COLUMN public.cs_survey_targets.dispatched_at IS
    'bridge API 가 distributions row 를 생성(또는 재확인)한 시각.';
COMMENT ON COLUMN public.cs_survey_targets.dispatch_channel IS
    '실제 선택된 채널 — email | sms. channel=auto 요청 시 연락처 유무로 결정됨.';
COMMENT ON COLUMN public.cs_survey_targets.dispatch_error IS
    'bridge 결과가 error 인 경우의 사유 문자열. 정상 발송/멱등 skipped 시 NULL.';

CREATE INDEX IF NOT EXISTS idx_cs_targets_distribution
    ON public.cs_survey_targets (distribution_id)
    WHERE distribution_id IS NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'cs_survey_targets'
          AND policyname = 'cs_targets_anon_dispatch_writeback'
    ) THEN
        EXECUTE 'DROP POLICY "cs_targets_anon_dispatch_writeback" ON public.cs_survey_targets';
    END IF;

    EXECUTE $p$
        CREATE POLICY "cs_targets_anon_dispatch_writeback"
          ON public.cs_survey_targets
          FOR UPDATE TO anon
          USING (step5_confirmed = true)
          WITH CHECK (step5_confirmed = true)
    $p$;
END $$;
