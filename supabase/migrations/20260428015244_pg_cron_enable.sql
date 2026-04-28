-- =============================================================================
-- Migration: pg_cron extension 활성화
-- Date:      2026-04-28 (운영 적용 완료)
-- Why: DB 후처리(Step 4 재심사 / lineage 진단 / raw 보존) 를 Supabase 안에서 자동 실행.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA cron TO postgres, service_role;
GRANT SELECT ON cron.job, cron.job_run_details TO authenticated, service_role;
