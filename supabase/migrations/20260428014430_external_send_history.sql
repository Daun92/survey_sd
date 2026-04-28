-- =============================================================================
-- Migration: 외부 6개월 발송이력 CSV 를 위한 cs_external_send_history 테이블
-- Date:      2026-04-17
-- Status:    DRAFT — staging 검증 후 운영 배포
-- =============================================================================
--
-- Context:
--   운영자가 수기로 관리하는 `6개월 발송이력(YYMM-YYMM).csv` 파일(~200 rows 규모)
--   은 Supabase `cs_survey_participation` (5 rows) 보다 훨씬 더 완전한 이력.
--   배치 생성 시 Step 4 중복 검증이 누락되는 사례(김아람 ×3 등) 방지를 위해
--   이 CSV 를 영속 테이블로 임포트하고, 브라우저 대시보드와 Step 4 RPC 가
--   모두 참조하도록 한다.
--
-- Scope:
--   1. cs_external_send_history 테이블 + 인덱스 2개 + UNIQUE 제약
--   2. anon writer RLS 정책 (브라우저 업로드 허용)
--
-- 매칭 정책:
--   - phone_e164 = 휴대전화에서 비숫자를 모두 제거한 digit-only 문자열
--     (예: '010-1234-5678' → '01012345678', '052 202 1543' → '0522021543')
--   - 브라우저 측 `normalizePhone()` 과 동일 규칙
--
-- 관련 plan: C:\Users\EXC\.claude\plans\agile-rolling-meteor.md
-- =============================================================================


-- ------------------------------------------------------------------
-- Section 1: 테이블 정의
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cs_external_send_history (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164    text NOT NULL,
    contact_name  text,
    company_name  text,
    course_name   text,
    sent_at       date NOT NULL,
    source        text DEFAULT 'csv_manual',
    file_name     text,
    imported_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE public.cs_external_send_history IS
    '운영자가 수기 관리하는 CS 설문 발송 이력. CSV 업로드로 주입. Step 4 자동 판정의 보조 소스.';
COMMENT ON COLUMN public.cs_external_send_history.phone_e164 IS
    '정규화된 휴대전화 (비숫자 제거, digit-only). 매칭 키.';
COMMENT ON COLUMN public.cs_external_send_history.source IS
    '이력 출처 — csv_manual(수기 CSV) / participation_sync(cs_survey_participation에서 동기화) / api 등 확장 가능.';


-- ------------------------------------------------------------------
-- Section 2: 인덱스
-- ------------------------------------------------------------------

-- 같은 사람이 같은 날 같은 과정 발송은 1건만 저장 (재업로드 idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS ux_external_send_unique
    ON public.cs_external_send_history (phone_e164, sent_at, course_name);

CREATE INDEX IF NOT EXISTS idx_external_send_phone
    ON public.cs_external_send_history (phone_e164);

CREATE INDEX IF NOT EXISTS idx_external_send_recent
    ON public.cs_external_send_history (sent_at DESC);


-- ------------------------------------------------------------------
-- Section 3: RLS 정책
-- ------------------------------------------------------------------
-- 현 단계는 대시보드가 anon 키로 동작하므로 anon 전체 허용.
-- 운영 전환 시 authenticated only 로 좁혀야 함.

ALTER TABLE public.cs_external_send_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cs_external_send_history'
      AND policyname='external_send_anon_rw'
  ) THEN
    EXECUTE 'DROP POLICY "external_send_anon_rw" ON public.cs_external_send_history';
  END IF;

  EXECUTE $p$
    CREATE POLICY "external_send_anon_rw"
      ON public.cs_external_send_history
      FOR ALL TO anon
      USING (true)
      WITH CHECK (true)
  $p$;
END $$;


-- ------------------------------------------------------------------
-- Section 4: 롤백 힌트
-- ------------------------------------------------------------------
-- -- DROP POLICY IF EXISTS "external_send_anon_rw" ON public.cs_external_send_history;
-- -- ALTER TABLE public.cs_external_send_history DISABLE ROW LEVEL SECURITY;
-- -- DROP INDEX IF EXISTS public.idx_external_send_recent;
-- -- DROP INDEX IF EXISTS public.idx_external_send_phone;
-- -- DROP INDEX IF EXISTS public.ux_external_send_unique;
-- -- DROP TABLE IF EXISTS public.cs_external_send_history;


-- ------------------------------------------------------------------
-- END of migration
-- ------------------------------------------------------------------
