-- mlops_* RLS 정규화 (2026-04-23)
--
-- 배경: 2026-04-22 `bris.*` drop 사고 수습 과정에서 일부 mlops_* 테이블
--   (mlops_alerts, mlops_quality_metrics) 이 anon/authenticated 에 전체
--   DML 권한을 노출한 상태로 남음. RLS 도 전부 off. 나머지 4개 테이블
--   (mlops_classifier_config, mlops_classifier_versions,
--    mlops_daily_corrections, mlops_pipeline_feedback) 은 service_role
--   SELECT 만 부여되어 있으나 RLS off.
--
-- 목표:
--   1. anon 은 아무 권한도 가지지 않는다 (모두 REVOKE)
--   2. authenticated 는 SELECT 만 허용, RLS 정책으로 USING (true)
--   3. INSERT/UPDATE/DELETE 는 service_role 만 — admin client (server
--      action / lab 라우트) 경유해서만 기록. RLS bypass 특성상 별도
--      정책 없이 동작
--   4. service_role 은 SELECT 외에도 INSERT/UPDATE/DELETE 부여 (쓰기
--      경로 복원)
--
-- 승격 조건 달성:
--   /admin/lab/bris/quality-timeline 이 createAdminClient 대신
--   createClient 로 조회 가능. 본 마이그레이션 적용 후 별도 코드 커밋에서
--   전환한다 (docs/dev/session-handoff-2026-04-23.md 과제 A 참조).

DO $$
DECLARE
  t RECORD;
  policy_name TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'mlops_%'
    ORDER BY tablename
  LOOP
    -- 1) 기존 권한 전부 회수
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t.tablename);

    -- 2) authenticated SELECT, service_role 전 DML
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t.tablename);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t.tablename);

    -- 3) RLS ON + FORCE (service_role 는 BYPASSRLS 로 통과)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);

    -- 4) SELECT 정책 (authenticated 전체 허용). 중복 방지 위해 DROP IF EXISTS
    policy_name := t.tablename || '_authenticated_select';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      policy_name, t.tablename
    );

    RAISE NOTICE 'mlops_rls_normalize: % done', t.tablename;
  END LOOP;
END $$;

-- PostgREST 스키마 캐시 리로드 (RLS · 권한 변경 즉시 반영)
NOTIFY pgrst, 'reload schema';
