-- name: hrd_dashboard_v2_rpcs
-- 22회 인재개발 실태조사 — /admin/hrd/dashboard v2 정보구조 지원 RPC 5개.
--
-- 합의 결정 (docs/admin-hrd-dashboard-v22-plan.md §4):
--   D-2: get_hrd_round_statistics 는 avg_score 보존 + likert_avg 컬럼 추가 (호환 유지).
--   D-3: 평균 응답 소요시간(분) 은 A 섹션 collection KPI 에 포함.
--   D-4: 일별 추세 기본 30일 (호출자 인자로 조정 가능).
--   D-5: 21vs22 비교는 50명 이상 임계치 — 임계치는 UI 가 판단 (RPC 는 항상 계산하여 반환).
--
-- 응답 0 케이스 (22회 collecting 직전) 안전 반환:
--   - 모든 함수는 NULL 분모를 NULLIF 로 보호.
--   - daily_completed 는 empty SETOF 반환 (UI 가 빈 차트 처리).
--
-- 권한: SECURITY DEFINER + authenticated. anon 차단.

-- ──────────────────────────────────────────────
-- 1. 수집 KPI (A 섹션)
--    target / completed / in_progress / invited / avg_minutes
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hrd_collection_kpi(p_round_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      rd.target_count                                                   AS target_count,
      COUNT(r.id)                                                       AS total_count,
      COUNT(*) FILTER (WHERE r.status = 'completed')                    AS completed_count,
      COUNT(*) FILTER (WHERE r.status = 'in_progress')                  AS in_progress_count,
      COUNT(*) FILTER (WHERE r.status = 'invited')                      AS invited_count,
      AVG(
        EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) / 60.0
      ) FILTER (
        WHERE r.status = 'completed'
          AND r.started_at IS NOT NULL
          AND r.completed_at IS NOT NULL
          AND r.completed_at > r.started_at
      )                                                                 AS avg_minutes
    FROM hrd_survey_rounds rd
    LEFT JOIN hrd_respondents r ON r.round_id = rd.id
    WHERE rd.id = p_round_id
    GROUP BY rd.target_count
  )
  SELECT jsonb_build_object(
    'target_count',      COALESCE(target_count, 0),
    'total_count',       COALESCE(total_count, 0),
    'completed_count',   COALESCE(completed_count, 0),
    'in_progress_count', COALESCE(in_progress_count, 0),
    'invited_count',     COALESCE(invited_count, 0),
    'completion_rate',   CASE
                           WHEN COALESCE(target_count, 0) = 0 THEN NULL
                           ELSE ROUND(completed_count::numeric * 100 / target_count, 1)
                         END,
    'avg_minutes',       CASE
                           WHEN avg_minutes IS NULL THEN NULL
                           ELSE ROUND(avg_minutes::numeric, 1)
                         END
  )
  FROM base;
$$;

COMMENT ON FUNCTION public.get_hrd_collection_kpi(uuid) IS
  '대시보드 A 섹션 — 수집 KPI. target/completed/in_progress/invited + 응답률 + 평균 응답 소요시간(분).';

-- ──────────────────────────────────────────────
-- 2. 응답자 분포 v2 (B 섹션)
--    org_type 5종 + industry 14종 분포를 한 호출에.
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hrd_respondent_breakdown_v2(p_round_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT
      org_type_code,
      org_type,
      COUNT(*) AS cnt
    FROM hrd_respondents
    WHERE round_id = p_round_id
      AND status IN ('completed', 'in_progress')
      AND org_type_code IS NOT NULL
    GROUP BY org_type_code, org_type
  ),
  ind AS (
    SELECT
      industry_code,
      industry_name,
      COUNT(*) AS cnt
    FROM hrd_respondents
    WHERE round_id = p_round_id
      AND status IN ('completed', 'in_progress')
      AND industry_code IS NOT NULL
    GROUP BY industry_code, industry_name
  )
  SELECT jsonb_build_object(
    'org_type',  COALESCE(
                   (SELECT jsonb_agg(
                              jsonb_build_object(
                                'code',  org_type_code,
                                'label', org_type,
                                'count', cnt
                              )
                              ORDER BY org_type_code
                            )
                      FROM org),
                   '[]'::jsonb
                 ),
    'industry',  COALESCE(
                   (SELECT jsonb_agg(
                              jsonb_build_object(
                                'code',  industry_code,
                                'label', industry_name,
                                'count', cnt
                              )
                              ORDER BY cnt DESC
                            )
                      FROM ind),
                   '[]'::jsonb
                 )
  );
$$;

COMMENT ON FUNCTION public.get_hrd_respondent_breakdown_v2(uuid) IS
  '대시보드 B 섹션 — 응답자 분포. org_type 5종 도넛 + industry 14종 가로막대용. completed/in_progress 만 집계.';

-- ──────────────────────────────────────────────
-- 3. 일별 완료 추세 (B 섹션 line)
--    default 30일, completed_at 기준 일별 COUNT.
--    응답이 없는 날도 0 으로 시리즈에 포함 (generate_series).
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hrd_daily_completed(
  p_round_id uuid,
  p_days     int DEFAULT 30
)
RETURNS TABLE (
  day        date,
  completed  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(
             (CURRENT_DATE - (p_days - 1))::date,
             CURRENT_DATE,
             INTERVAL '1 day'
           )::date AS day
  ),
  agg AS (
    SELECT
      completed_at::date AS day,
      COUNT(*)::bigint   AS completed
    FROM hrd_respondents
    WHERE round_id     = p_round_id
      AND status       = 'completed'
      AND completed_at IS NOT NULL
      AND completed_at >= CURRENT_DATE - (p_days - 1)
    GROUP BY completed_at::date
  )
  SELECT
    d.day,
    COALESCE(a.completed, 0) AS completed
  FROM days d
  LEFT JOIN agg a ON a.day = d.day
  ORDER BY d.day ASC;
$$;

COMMENT ON FUNCTION public.get_hrd_daily_completed(uuid, int) IS
  '대시보드 B 섹션 — 일별 완료 추세. 기본 30일, 응답 0 인 날도 0 으로 시리즈 채움.';

-- ──────────────────────────────────────────────
-- 4. 응답 품질 (C 섹션)
--    - 평균 응답률(문항): completed 응답자 1명이 평균 몇 % 문항을 채웠나
--    - 응답 0건 문항 수: 한 명도 답하지 않은 item 개수
--    - 미응답(invited) 응답자 수
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hrd_response_quality(p_round_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH counts AS (
    SELECT
      (SELECT COUNT(*) FROM hrd_survey_items
        WHERE round_id = p_round_id)                                   AS items_n,
      (SELECT COUNT(*) FROM hrd_respondents
        WHERE round_id = p_round_id
          AND status = 'completed')                                    AS completed_n,
      (SELECT COUNT(*) FROM hrd_responses
        WHERE round_id = p_round_id)                                   AS responses_n,
      (SELECT COUNT(DISTINCT item_id) FROM hrd_responses
        WHERE round_id = p_round_id)                                   AS items_with_response,
      (SELECT COUNT(*) FROM hrd_respondents
        WHERE round_id = p_round_id
          AND status = 'invited')                                      AS invited_n
  )
  SELECT jsonb_build_object(
    'items_n',              items_n,
    'completed_n',          completed_n,
    'responses_n',          responses_n,
    'avg_completion_rate',  CASE
                              WHEN completed_n = 0 OR items_n = 0 THEN NULL
                              ELSE ROUND(
                                     responses_n::numeric * 100
                                       / NULLIF(completed_n * items_n, 0),
                                     1)
                            END,
    'zero_response_items',  items_n - items_with_response,
    'invited_n',            invited_n
  )
  FROM counts;
$$;

COMMENT ON FUNCTION public.get_hrd_response_quality(uuid) IS
  '대시보드 C 섹션 — 응답 품질. 평균 응답률(completed 1명당 문항 채움률) + 응답 0건 문항 수 + 미응답 응답자 수.';

-- ──────────────────────────────────────────────
-- 5. 회차 비교 (E 섹션)
--    likert_5 / likert_importance_performance 항목만 평균 비교.
--    item_code 매칭 (같은 코드의 22회 ↔ 21회 item).
--    delta = b_mean - a_mean (예: a=21회 baseline, b=22회 현재).
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hrd_round_compare(
  p_round_a    uuid,
  p_round_b    uuid,
  p_item_codes text[] DEFAULT NULL
)
RETURNS TABLE (
  item_code   text,
  question    text,
  a_mean      numeric,
  a_count     bigint,
  b_mean      numeric,
  b_count     bigint,
  delta       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH a_items AS (
    SELECT i.id, i.item_code, i.question_text
    FROM hrd_survey_items i
    WHERE i.round_id = p_round_a
      AND i.answer_type IN ('likert_5', 'likert_importance_performance')
      AND (p_item_codes IS NULL OR i.item_code = ANY(p_item_codes))
  ),
  b_items AS (
    SELECT i.id, i.item_code, i.question_text
    FROM hrd_survey_items i
    WHERE i.round_id = p_round_b
      AND i.answer_type IN ('likert_5', 'likert_importance_performance')
      AND (p_item_codes IS NULL OR i.item_code = ANY(p_item_codes))
  ),
  a_agg AS (
    SELECT
      ai.item_code,
      ai.question_text,
      AVG(r.value_number) AS mean,
      COUNT(r.value_number) AS cnt
    FROM a_items ai
    LEFT JOIN hrd_responses     r  ON r.item_id = ai.id AND r.round_id = p_round_a
    LEFT JOIN hrd_respondents   rs ON rs.id     = r.respondent_id AND rs.status = 'completed'
    GROUP BY ai.item_code, ai.question_text
  ),
  b_agg AS (
    SELECT
      bi.item_code,
      bi.question_text,
      AVG(r.value_number) AS mean,
      COUNT(r.value_number) AS cnt
    FROM b_items bi
    LEFT JOIN hrd_responses     r  ON r.item_id = bi.id AND r.round_id = p_round_b
    LEFT JOIN hrd_respondents   rs ON rs.id     = r.respondent_id AND rs.status = 'completed'
    GROUP BY bi.item_code, bi.question_text
  )
  SELECT
    COALESCE(a.item_code, b.item_code)                                    AS item_code,
    COALESCE(a.question_text, b.question_text)                            AS question,
    ROUND(a.mean::numeric, 2)                                             AS a_mean,
    a.cnt::bigint                                                         AS a_count,
    ROUND(b.mean::numeric, 2)                                             AS b_mean,
    b.cnt::bigint                                                         AS b_count,
    CASE
      WHEN a.mean IS NULL OR b.mean IS NULL THEN NULL
      ELSE ROUND((b.mean - a.mean)::numeric, 2)
    END                                                                   AS delta
  FROM a_agg a
  FULL OUTER JOIN b_agg b USING (item_code)
  ORDER BY COALESCE(a.item_code, b.item_code);
$$;

COMMENT ON FUNCTION public.get_hrd_round_compare(uuid, uuid, text[]) IS
  '대시보드 E 섹션 — 회차 비교. likert 항목만 mean·count 비교, delta=b-a. item_codes=NULL 이면 전체 likert.';

-- ──────────────────────────────────────────────
-- 6. get_hrd_round_statistics — likert_avg 컬럼 추가 (D-2 (b) 결정)
--    기존 avg_score 보존, 신규 likert_avg = likert 항목 한정 평균.
--    호출 코드 호환 유지 (drop function 없이 OR REPLACE 로는 return type 변경 불가
--     → 명시적으로 DROP 후 재생성).
-- ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_hrd_round_statistics(uuid);

CREATE FUNCTION public.get_hrd_round_statistics(p_round_id uuid)
RETURNS TABLE (
  total_responses    bigint,
  unique_respondents bigint,
  unique_items       bigint,
  avg_score          numeric,   -- DEPRECATED: 단위 섞임. UI 미사용.
  likert_avg         numeric    -- v2 — likert_5 / likert_importance_performance 한정 평균.
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint                                  AS total_responses,
    COUNT(DISTINCT r.respondent_id)::bigint           AS unique_respondents,
    COUNT(DISTINCT r.item_id)::bigint                 AS unique_items,
    ROUND(
      AVG(r.value_number) FILTER (WHERE r.value_number IS NOT NULL)::numeric,
      2
    )                                                 AS avg_score,
    ROUND(
      AVG(r.value_number) FILTER (
        WHERE r.value_number IS NOT NULL
          AND i.answer_type IN ('likert_5', 'likert_importance_performance')
      )::numeric,
      2
    )                                                 AS likert_avg
  FROM hrd_responses r
  LEFT JOIN hrd_survey_items i ON i.id = r.item_id
  WHERE r.round_id = p_round_id;
$$;

COMMENT ON FUNCTION public.get_hrd_round_statistics(uuid) IS
  '회차 전체 요약. avg_score 는 단위 섞여 의미 없음(deprecated). likert_avg 가 v2 정상 평균.';

-- ──────────────────────────────────────────────
-- 권한
-- ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_hrd_collection_kpi(uuid)           FROM public, anon;
REVOKE ALL ON FUNCTION public.get_hrd_respondent_breakdown_v2(uuid)  FROM public, anon;
REVOKE ALL ON FUNCTION public.get_hrd_daily_completed(uuid, int)     FROM public, anon;
REVOKE ALL ON FUNCTION public.get_hrd_response_quality(uuid)         FROM public, anon;
REVOKE ALL ON FUNCTION public.get_hrd_round_compare(uuid, uuid, text[]) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_hrd_round_statistics(uuid)         FROM public, anon;

GRANT EXECUTE ON FUNCTION public.get_hrd_collection_kpi(uuid)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hrd_respondent_breakdown_v2(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hrd_daily_completed(uuid, int)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hrd_response_quality(uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hrd_round_compare(uuid, uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hrd_round_statistics(uuid)         TO authenticated, service_role;

-- ──────────────────────────────────────────────
-- 추가 인덱스 (B 일별 추세 + C 응답 품질 가속)
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hrd_respondents_round_completed_at
  ON hrd_respondents(round_id, completed_at)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_hrd_respondents_round_status_industry
  ON hrd_respondents(round_id, status, industry_code);
