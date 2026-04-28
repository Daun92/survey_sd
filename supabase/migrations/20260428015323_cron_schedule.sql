-- =============================================================================
-- Migration: 데이터 공장 스케줄 — pg_cron 등록
-- Date:      2026-04-28 (운영 적용 완료)
-- Why:
--   "수집 → 정제 → 분류" 파이프라인의 DB 후처리 단계를 Supabase 안에서 자동화.
--   BRIS 호출(수집/정제) 은 사내망 접근 필요 → 외부 host cron 유지.
--   분류·재심사·정리·진단 은 DB 안 데이터만 다루므로 pg_cron 으로 옮김.
-- =============================================================================

-- Section 1: Wrapper 함수
CREATE OR REPLACE FUNCTION public.fn_cs_cron_step4_recheck()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_started_at timestamptz := now();
  v_batch RECORD;
  v_total_batches int := 0;
  v_total_excluded int := 0;
  v_result jsonb;
BEGIN
  FOR v_batch IN
    SELECT id FROM cs_target_batches
    WHERE created_at >= now() - INTERVAL '14 days'
      AND status NOT IN ('archived','dispatched_complete')
  LOOP
    BEGIN
      v_result := (SELECT row_to_json(r)::jsonb FROM (
        SELECT * FROM fn_cs_step4_check_survey_history(v_batch.id) LIMIT 1
      ) r);
      v_total_batches := v_total_batches + 1;
      v_total_excluded := v_total_excluded + COALESCE((v_result->>'excluded')::int, 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'fn_cs_cron_step4_recheck: batch % 실패 — %', v_batch.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'job', 'step4_recheck',
    'started_at', v_started_at, 'finished_at', now(),
    'batches_processed', v_total_batches, 'total_excluded', v_total_excluded
  );
END;
$$;
COMMENT ON FUNCTION public.fn_cs_cron_step4_recheck IS
  'pg_cron 매일 호출 — 외부 CSV 업로드 비동기 반영용 Step 4 재심사. 최근 14일 active batch 대상.';

CREATE OR REPLACE FUNCTION public.fn_cs_cron_lineage_audit()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_health RECORD;
BEGIN
  SELECT * INTO v_health FROM v_cs_bris_lineage_health;
  RETURN jsonb_build_object(
    'job', 'lineage_audit', 'at', now(),
    'raw_pages_total', v_health.raw_pages_total,
    'raw_records_total', v_health.raw_records_total,
    'courses_orphan', v_health.courses_orphan,
    'projects_orphan', v_health.projects_orphan,
    'contacts_orphan', v_health.contacts_orphan
  );
END;
$$;
COMMENT ON FUNCTION public.fn_cs_cron_lineage_audit IS
  'pg_cron 매일 — Layer 0/1 lineage 채움률 진단 결과 반환. 모니터링용.';

CREATE OR REPLACE FUNCTION public.fn_cs_cron_raw_retention(p_keep_days int DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pages_compacted int := 0;
BEGIN
  UPDATE cs_bris_raw_pages
  SET raw_html = NULL
  WHERE fetched_at < now() - (p_keep_days || ' days')::interval
    AND raw_html IS NOT NULL;
  GET DIAGNOSTICS v_pages_compacted = ROW_COUNT;
  RETURN jsonb_build_object(
    'job', 'raw_retention', 'at', now(),
    'keep_days', p_keep_days, 'pages_compacted', v_pages_compacted
  );
END;
$$;
COMMENT ON FUNCTION public.fn_cs_cron_raw_retention IS
  'pg_cron 주간 — N일 초과 cs_bris_raw_pages 의 raw_html 만 NULL 로 압축. payload(records) 는 유지.';

-- Section 2: cron 등록 (UTC 기준)
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job WHERE jobname IN
    ('cs_step4_recheck_daily', 'cs_lineage_audit_daily', 'cs_raw_retention_weekly')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

SELECT cron.schedule('cs_step4_recheck_daily',  '0 22 * * *',
  $$ SELECT public.fn_cs_cron_step4_recheck(); $$);
SELECT cron.schedule('cs_lineage_audit_daily',  '0 23 * * *',
  $$ SELECT public.fn_cs_cron_lineage_audit(); $$);
SELECT cron.schedule('cs_raw_retention_weekly', '0 14 * * 0',
  $$ SELECT public.fn_cs_cron_raw_retention(90); $$);

-- Section 3: 모니터링 뷰
CREATE OR REPLACE VIEW public.v_cs_cron_status AS
SELECT
  j.jobname, j.schedule, j.active, j.command,
  (SELECT MAX(start_time) FROM cron.job_run_details d WHERE d.jobid = j.jobid) AS last_run_at,
  (SELECT status FROM cron.job_run_details d
    WHERE d.jobid = j.jobid ORDER BY start_time DESC LIMIT 1) AS last_status,
  (SELECT return_message FROM cron.job_run_details d
    WHERE d.jobid = j.jobid ORDER BY start_time DESC LIMIT 1) AS last_message
FROM cron.job j
WHERE j.jobname LIKE 'cs_%'
ORDER BY j.jobname;
COMMENT ON VIEW public.v_cs_cron_status IS
  'cs_* pg_cron 작업의 등록 정보 + 마지막 실행 시각/상태/메시지. 대시보드 모니터링용.';
GRANT SELECT ON public.v_cs_cron_status TO authenticated, anon;
