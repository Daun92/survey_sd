-- =============================================================================
-- Migration: v_cs_dispatch_summary 재정의 (distributions.cs_batch_id 기반) + fn_cs_dispatch_batch deprecation
-- Date:      2026-04-28 (운영 적용 완료, supabase_migrations version=20260428024509)
-- Origin:    cs_master/supabase/migrations/20260416_v_cs_dispatch_summary.sql 의 retro-register
-- =============================================================================
-- Why: 이전엔 distributions.cs_batch_id 컬럼이 없어 retro-register 가 불가했음.
--      20260428024400_distributions_cs_link 적용 후 의존성 해소되어 본 마이그레이션 가능.
--      기존 11 컬럼(batch_status/pending_count/opened_count/skipped_count 포함) 모두 보존.
-- =============================================================================

-- 의존성 0 확인 후 DROP + CREATE (CREATE OR REPLACE 는 컬럼 시그니처 변경 거부)
DROP VIEW IF EXISTS public.v_cs_dispatch_summary;

CREATE VIEW public.v_cs_dispatch_summary AS
SELECT
    b.id                                                              AS batch_id,
    b.batch_name,
    b.status                                                          AS batch_status,
    COUNT(d.id)                                                       AS total_dispatched,
    COUNT(d.id) FILTER (WHERE d.status IN ('sent','opened','started','completed')) AS sent_count,
    COUNT(d.id) FILTER (WHERE d.status = 'pending')                   AS pending_count,
    COUNT(d.id) FILTER (WHERE d.status IN ('opened','started','completed'))        AS opened_count,
    COUNT(d.id) FILTER (WHERE d.status = 'completed')                 AS responded_count,
    COUNT(d.id) FILTER (WHERE d.status = 'failed')                    AS failed_count,
    COUNT(d.id) FILTER (WHERE d.status = 'bounced')                   AS skipped_count,
    COALESCE(
        ROUND(100.0 * COUNT(d.id) FILTER (WHERE d.status = 'completed')
                    / NULLIF(COUNT(d.id), 0), 1),
        0
    )                                                                  AS response_rate
FROM public.cs_target_batches b
LEFT JOIN public.distributions d ON d.cs_batch_id = b.id
GROUP BY b.id, b.batch_name, b.status;

COMMENT ON VIEW public.v_cs_dispatch_summary IS
    'cs 배치별 발송 현황 집계 뷰. source of truth = survey_sd.distributions (cs_batch_id 링크).';

-- fn_cs_dispatch_batch deprecation stub
-- 기존 시그니처에 default 파라미터가 있어 CREATE OR REPLACE 가 거부됨 → DROP 먼저
DROP FUNCTION IF EXISTS public.fn_cs_dispatch_batch(uuid, text, text);

CREATE FUNCTION public.fn_cs_dispatch_batch(
    p_batch_id uuid, p_channel text, p_survey_base_url text)
RETURNS TABLE(dispatched int, skipped int, errors int)
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'fn_cs_dispatch_batch is deprecated (2026-04-16). Use POST /api/distributions/cs-bridge on survey_sd instead.';
END;
$$;
COMMENT ON FUNCTION public.fn_cs_dispatch_batch(uuid, text, text) IS
    'Deprecated 2026-04-16. Replaced by survey_sd bridge API.';
