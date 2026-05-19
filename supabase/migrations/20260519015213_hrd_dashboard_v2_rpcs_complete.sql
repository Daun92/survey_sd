-- 22회 HRD 대시보드 v2 — 누락 함수 보완 (2026-05-14 hrd_dashboard_v2_rpcs 후속).
-- 원본 마이그레이션이 MCP apply 시점에 4 함수만 적용되어 있던 상태에서,
-- B 섹션 분포 차트(_v2 breakdown) 와 C 섹션(response_quality) 함수 2개를 추가 적용.
--
-- 적용 경위: 20260514002250 _hrd_dashboard_v2_rpcs 가 등록될 당시 MCP apply 가
-- 부분 적용된 상태로 schema_migrations 에 기록되어 있었고, 본 후속 마이그레이션
-- 으로 누락분을 채움. fresh install 에서는 본 파일이 멱등 no-op 가 됨
-- (CREATE OR REPLACE / IF NOT EXISTS).

-- ──────────────────────────────────────────────
-- B 섹션 응답자 분포 v2 (org_type 도넛 + industry 가로막대)
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
-- C 섹션 응답 품질 (avg_completion_rate / zero_response_items / invited_n)
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
-- 권한
-- ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_hrd_respondent_breakdown_v2(uuid)  FROM public, anon;
REVOKE ALL ON FUNCTION public.get_hrd_response_quality(uuid)         FROM public, anon;

GRANT EXECUTE ON FUNCTION public.get_hrd_respondent_breakdown_v2(uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hrd_response_quality(uuid)         TO authenticated, service_role;

-- ──────────────────────────────────────────────
-- 인덱스 (B 일별 추세 + C 응답 품질 가속)
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hrd_respondents_round_completed_at
  ON hrd_respondents(round_id, completed_at)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_hrd_respondents_round_status_industry
  ON hrd_respondents(round_id, status, industry_code);
