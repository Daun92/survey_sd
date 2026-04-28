-- =============================================================================
-- Migration: fn_cs_step4_check_survey_history 에 cs_external_send_history 반영
-- Date:      2026-04-28 (운영 적용 완료, supabase_migrations version=20260428013821)
-- Origin:    cs_master/supabase/migrations/20260417_fn_step4_with_external.sql
--            (원본은 절차 안내 템플릿이었음 — 본문 합성하여 적용)
-- =============================================================================
-- Why: Step 4 자동 판정이 cs_external_send_history(CSV 업로드 이력)도 참조하도록
--      확장. 기존엔 cs_contacts.last_survey_date 만 봤으므로 운영자가 수기로
--      넣은 발송 이력이 자동 배제에 반영되지 않았음.
-- 적용 시점: 2026-04-28 운영 DB 직접 적용 (β 워크플로우).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_cs_step4_check_survey_history(p_batch_id uuid)
 RETURNS TABLE(checked integer, passed integer, excluded integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_checked INT := 0; v_passed INT := 0; v_excluded INT := 0;
BEGIN
  -- 1) cs_contacts.last_survey_date 기반 (기존 로직 유지)
  UPDATE cs_survey_targets t SET
    step4_history_checked = true,
    step4_checked_at = now(),
    step4_last_survey_date = co.last_survey_date,
    step4_within_6months = (co.last_survey_date IS NOT NULL AND co.last_survey_date >= CURRENT_DATE - INTERVAL '6 months'),
    current_step = CASE
      WHEN co.last_survey_date IS NULL OR co.last_survey_date < CURRENT_DATE - INTERVAL '6 months'
      THEN 4 ELSE t.current_step END,
    status = CASE
      WHEN co.last_survey_date IS NOT NULL AND co.last_survey_date >= CURRENT_DATE - INTERVAL '6 months'
      THEN 'excluded' ELSE t.status END,
    is_eligible = CASE
      WHEN co.last_survey_date IS NOT NULL AND co.last_survey_date >= CURRENT_DATE - INTERVAL '6 months'
      THEN false ELSE t.is_eligible END,
    exclusion_reason = CASE
      WHEN co.last_survey_date IS NOT NULL AND co.last_survey_date >= CURRENT_DATE - INTERVAL '6 months'
      THEN '6개월 이내 참여' ELSE t.exclusion_reason END,
    updated_at = now()
  FROM cs_contacts co
  WHERE co.id = t.contact_id
    AND t.batch_id = p_batch_id
    AND t.current_step = 3
    AND t.status = 'screening';

  GET DIAGNOSTICS v_checked = ROW_COUNT;

  -- 2) cs_external_send_history 교차 체크 (CSV 업로드 이력)
  UPDATE public.cs_survey_targets t
  SET
    step4_within_6months    = TRUE,
    step4_history_checked   = TRUE,
    step4_last_survey_date  = sub.latest_sent::date,
    status                  = 'excluded',
    is_eligible             = FALSE,
    current_step            = 4,
    exclusion_reason        = COALESCE(NULLIF(t.exclusion_reason, ''), '6개월 이내 참여 (external CSV)'),
    updated_at              = now()
  FROM (
    SELECT
      ct.id AS contact_id,
      MAX(h.sent_at) AS latest_sent
    FROM public.cs_contacts ct
    JOIN public.cs_external_send_history h
      ON h.phone_e164 = regexp_replace(COALESCE(ct.mobile, ct.phone, ''), '\D', '', 'g')
     AND h.phone_e164 <> ''
    WHERE h.sent_at > CURRENT_DATE - INTERVAL '180 days'
    GROUP BY ct.id
  ) sub
  WHERE t.contact_id = sub.contact_id
    AND t.batch_id   = p_batch_id
    AND (t.step4_within_6months IS DISTINCT FROM TRUE);

  SELECT count(*) INTO v_passed FROM cs_survey_targets
    WHERE batch_id = p_batch_id AND current_step = 4;
  SELECT count(*) INTO v_excluded FROM cs_survey_targets
    WHERE batch_id = p_batch_id AND exclusion_reason ILIKE '%6개월 이내 참여%';

  RETURN QUERY SELECT v_checked, v_passed, v_excluded;
END;
$function$;
