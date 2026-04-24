-- bris_api_keys 보존(COMMENT 박제) + 권한 잠금 (2026-04-23)
--
-- 배경:
--   - 4/22 bris.api_keys → public.bris_api_keys rename 후 권한 정비 누락.
--     anon/authenticated 가 p_key/encrypt_key/v_key 자격증명을 **읽고·쓸 수**
--     있는 상태로 방치되어 있었음 (mlops_alerts 와 같은 공백)
--   - 2026-04-23 세션에서 "보존 + COMMENT 박제" 로 처분 결정
--     (session-handoff-2026-04-23.md 과제 B). drop 은 유보, 사내 서버
--     이전·키 재발급 상시 가능 정책으로 잔류 유지
--
-- 이 마이그레이션:
--   1. COMMENT 갱신 — legacy 상태·미사용·복구 가능성 명시
--   2. anon/authenticated 에서 모든 권한 회수 (자격증명 유출 차단)
--   3. authenticated 는 SELECT 만, RLS 정책 `authenticated USING (true)`
--      — admin UI 에서 필요 시 조회 가능하도록 (lab 경유)
--   4. service_role 은 전 DML — 외부 수집 스크립트가 부활할 때 재사용

COMMENT ON TABLE public.bris_api_keys IS
  'Legacy dnExcel endpoint credentials (11 endpoints). 2026-04-22 bris.api_keys → public 이관. '
  '**2026-04-23 현재 미사용** — 신규 수집은 bris-api-server HTML 파싱 경로 사용. '
  '보존 결정: 사내 서버 이전·재활성화 가능성 대비 + 키 재발급 절차 상시 가능 (drop 유보). '
  '자격증명 유출 방지 위해 RLS 적용. 상세: docs/dev/bris-collection-sources.md §4-1, '
  'session-handoff-2026-04-23.md 과제 B.';

-- 권한 회수
REVOKE ALL ON public.bris_api_keys FROM PUBLIC;
REVOKE ALL ON public.bris_api_keys FROM anon;
REVOKE ALL ON public.bris_api_keys FROM authenticated;

-- authenticated SELECT 만, service_role 전 DML
GRANT SELECT ON public.bris_api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bris_api_keys TO service_role;

-- RLS 적용 + authenticated SELECT 정책
ALTER TABLE public.bris_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bris_api_keys_authenticated_select ON public.bris_api_keys;
CREATE POLICY bris_api_keys_authenticated_select
  ON public.bris_api_keys
  FOR SELECT
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
