-- name: hrd_item_distribution_rpc
-- 22회 분석 인프라 — 항목별 응답 분포 RPC.
--
-- answer_type 분기:
--   number/percent/currency/likert_5/likert_importance_performance
--                                  → 통계 요약 (count, mean, median, stddev, min/max, q1/q3)
--   single_choice                  → 옵션별 count
--   multiple_choice                → 옵션별 count (value_json 의 array 를 unnest)
--   text/email/phone/year_month/date → 응답 수 + 텍스트 샘플 5건
--
-- 분석 대상: 완료(`status='completed'`) 응답자의 응답만. 부분 응답은 통계 왜곡 방지로 제외.
--
-- 반환: jsonb (UI 에서 type 분기). 빈 응답이면 response_count=0 + 적절한 기본 구조.
--
-- 호출 예: SELECT public.get_hrd_item_distribution('<round_id>'::uuid, '<item_id>'::uuid);

CREATE OR REPLACE FUNCTION public.get_hrd_item_distribution(
  p_round_id uuid,
  p_item_id  uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_answer_type   text;
  v_options       jsonb;
  v_result        jsonb;
BEGIN
  SELECT answer_type, answer_options
    INTO v_answer_type, v_options
    FROM public.hrd_survey_items
   WHERE id = p_item_id;

  IF v_answer_type IS NULL THEN
    RETURN jsonb_build_object('error', 'item not found', 'item_id', p_item_id);
  END IF;

  ---------------------------------------------------------------------
  -- 1) 숫자형 — number / percent / currency / likert_*
  ---------------------------------------------------------------------
  IF v_answer_type IN ('number', 'percent', 'currency',
                       'likert_5', 'likert_importance_performance') THEN
    SELECT jsonb_build_object(
      'type',           v_answer_type,
      'response_count', COUNT(*),
      'mean',           AVG(r.value_number),
      'median',         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.value_number),
      'stddev',         STDDEV_SAMP(r.value_number),
      'min',            MIN(r.value_number),
      'max',            MAX(r.value_number),
      'q1',             PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY r.value_number),
      'q3',             PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY r.value_number)
    )
    INTO v_result
    FROM public.hrd_responses     r
    JOIN public.hrd_respondents   rs ON rs.id = r.respondent_id
    WHERE r.round_id  = p_round_id
      AND r.item_id   = p_item_id
      AND rs.status   = 'completed'
      AND r.value_number IS NOT NULL;

  ---------------------------------------------------------------------
  -- 2) 단일 선택 — single_choice (value_text 에 단일 값)
  ---------------------------------------------------------------------
  ELSIF v_answer_type = 'single_choice' THEN
    WITH responses AS (
      SELECT r.value_text AS opt_value
      FROM public.hrd_responses    r
      JOIN public.hrd_respondents  rs ON rs.id = r.respondent_id
      WHERE r.round_id = p_round_id
        AND r.item_id  = p_item_id
        AND rs.status  = 'completed'
        AND r.value_text IS NOT NULL
    ),
    total AS (SELECT COUNT(*) AS n FROM responses),
    grouped AS (
      SELECT opt_value, COUNT(*) AS cnt
      FROM responses
      GROUP BY opt_value
    )
    SELECT jsonb_build_object(
      'type',           v_answer_type,
      'response_count', (SELECT n FROM total),
      'options',        COALESCE(
                          jsonb_agg(
                            jsonb_build_object(
                              'value',   opt_value,
                              'count',   cnt,
                              'percent', CASE WHEN (SELECT n FROM total) = 0 THEN 0
                                              ELSE ROUND(cnt::numeric * 100 / (SELECT n FROM total), 2)
                                         END
                            )
                            ORDER BY cnt DESC
                          ),
                          '[]'::jsonb
                        )
    )
    INTO v_result
    FROM grouped;

  ---------------------------------------------------------------------
  -- 3) 복수 선택 — multiple_choice (value_json array 를 unnest)
  --    분모: 해당 항목에 응답한 응답자 수 (옵션 다중 선택 → 100% 초과 가능)
  ---------------------------------------------------------------------
  ELSIF v_answer_type = 'multiple_choice' THEN
    WITH responses AS (
      SELECT r.id AS response_id, r.value_json
      FROM public.hrd_responses    r
      JOIN public.hrd_respondents  rs ON rs.id = r.respondent_id
      WHERE r.round_id = p_round_id
        AND r.item_id  = p_item_id
        AND rs.status  = 'completed'
        AND r.value_json IS NOT NULL
    ),
    base AS (SELECT COUNT(*) AS n FROM responses),
    unnested AS (
      SELECT jsonb_array_elements_text(value_json) AS opt_value
      FROM responses
    ),
    grouped AS (
      SELECT opt_value, COUNT(*) AS cnt
      FROM unnested
      GROUP BY opt_value
    )
    SELECT jsonb_build_object(
      'type',           v_answer_type,
      'response_count', (SELECT n FROM base),
      'options',        COALESCE(
                          jsonb_agg(
                            jsonb_build_object(
                              'value',   opt_value,
                              'count',   cnt,
                              'percent', CASE WHEN (SELECT n FROM base) = 0 THEN 0
                                              ELSE ROUND(cnt::numeric * 100 / (SELECT n FROM base), 2)
                                         END
                            )
                            ORDER BY cnt DESC
                          ),
                          '[]'::jsonb
                        )
    )
    INTO v_result
    FROM grouped;

  ---------------------------------------------------------------------
  -- 4) 텍스트류 — text/email/phone/year_month/date/comma_separated/rank_order
  --    응답 수 + 샘플 5건만.
  ---------------------------------------------------------------------
  ELSE
    SELECT jsonb_build_object(
      'type',           v_answer_type,
      'response_count', COUNT(*),
      'samples',        COALESCE(
                          (SELECT jsonb_agg(value_text)
                             FROM (
                               SELECT r.value_text
                                 FROM public.hrd_responses    r
                                 JOIN public.hrd_respondents  rs ON rs.id = r.respondent_id
                                WHERE r.round_id = p_round_id
                                  AND r.item_id  = p_item_id
                                  AND rs.status  = 'completed'
                                  AND r.value_text IS NOT NULL
                                LIMIT 5
                             ) s),
                          '[]'::jsonb
                        )
    )
    INTO v_result
    FROM public.hrd_responses     r
    JOIN public.hrd_respondents   rs ON rs.id = r.respondent_id
    WHERE r.round_id = p_round_id
      AND r.item_id  = p_item_id
      AND rs.status  = 'completed';
  END IF;

  -- item 메타 동봉 (UI 에서 옵션 라벨 매핑 위해)
  RETURN jsonb_build_object(
    'item_id',         p_item_id,
    'answer_type',     v_answer_type,
    'answer_options',  v_options,
    'data',            COALESCE(v_result, jsonb_build_object('type', v_answer_type, 'response_count', 0))
  );
END $$;

-- 인증된 사용자(admin) 만 호출. anon 차단.
REVOKE ALL ON FUNCTION public.get_hrd_item_distribution(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_hrd_item_distribution(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_hrd_item_distribution(uuid, uuid) IS
  '항목별 응답 분포 분석 — 완료(status=completed) 응답자만 집계. UI 에서 type 분기로 차트 렌더.';
