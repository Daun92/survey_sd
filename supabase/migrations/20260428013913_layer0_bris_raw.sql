-- =============================================================================
-- Migration: Layer 0 (BRONZE) — BRIS 원본 보존 레이어 + Layer 1 lineage
-- Date:      2026-04-28 (운영 적용 완료, supabase_migrations version=20260428013913)
-- Origin:    cs_master 측 신규 작성 (옵션 B 합의 후 survey_sd 단일 진실원으로 흡수)
-- =============================================================================
-- Why: "Supabase = BRIS 데이터 공장" 아키텍처의 가장 아래층(원료 입고).
--      BRIS HTML/파서 dict 를 immutable, append-only 로 보존해
--      (1) 단계별 판단의 출처 추적 가능 (auditability)
--      (2) 파서 버그 수정/룰 변경 시 BRIS 재호출 없이 재처리(replay) 가능
--      (3) cron 실패/장애 시에도 마지막 적재본으로 운영 지속
--
-- 후속 작업: bris_to_supabase.py 의 _upsert_* 가 source_raw_record_id 채우도록 패치.
-- =============================================================================

-- Section 1: 페이지 단위 원본 (HTTP 응답 1건 = 1 row)
CREATE TABLE IF NOT EXISTS public.cs_bris_raw_pages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_kind       text NOT NULL,
    bris_url        text NOT NULL,
    fetch_params    jsonb NOT NULL DEFAULT '{}'::jsonb,
    raw_html        text,
    raw_bytes_sha1  text NOT NULL,
    fetched_at      timestamptz NOT NULL DEFAULT now(),
    fetched_by      text,
    sync_id         uuid REFERENCES public.cs_sync_logs(id) ON DELETE SET NULL,
    CONSTRAINT cs_bris_raw_pages_kind_check
        CHECK (page_kind IN ('integrated','edu_detail','echo_view','echo_operate',
                             'project_detail','project_biz_list','dm','other'))
);

COMMENT ON TABLE public.cs_bris_raw_pages IS
  'Layer 0 (BRONZE): BRIS HTTP 응답 immutable 보존. append-only.';
COMMENT ON COLUMN public.cs_bris_raw_pages.page_kind IS
  '파서 종류 — integrated|edu_detail|echo_view|echo_operate|project_detail|project_biz_list|dm|other';
COMMENT ON COLUMN public.cs_bris_raw_pages.fetch_params IS
  '{sDate,eDate,BUSINESS_ID,PROJECT_ID,CUSTOMER_ID,...} BRIS 호출 파라미터';
COMMENT ON COLUMN public.cs_bris_raw_pages.raw_html IS
  'EUC-KR → UTF-8 변환 후 원본 HTML. NULL 가능(공간 절약 정책 시).';
COMMENT ON COLUMN public.cs_bris_raw_pages.raw_bytes_sha1 IS
  '응답 바디 SHA1. 동일 요청 중복 적재 단축회로용.';
COMMENT ON COLUMN public.cs_bris_raw_pages.fetched_by IS
  'cron|manual:userid|browser:userid — 입고 채널 추적';

CREATE UNIQUE INDEX IF NOT EXISTS uq_cs_bris_raw_pages_dedup
    ON public.cs_bris_raw_pages (page_kind, raw_bytes_sha1);
CREATE INDEX IF NOT EXISTS idx_cs_bris_raw_pages_fetched
    ON public.cs_bris_raw_pages (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_bris_raw_pages_sync
    ON public.cs_bris_raw_pages (sync_id) WHERE sync_id IS NOT NULL;

-- Section 2: 레코드 단위 — 통합 페이지 등 1:N 분해
CREATE TABLE IF NOT EXISTS public.cs_bris_raw_records (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id         uuid NOT NULL REFERENCES public.cs_bris_raw_pages(id) ON DELETE CASCADE,
    record_kind     text NOT NULL,
    record_index    int,
    payload         jsonb NOT NULL,
    business_id     text,
    project_id      text,
    customer_id     text,
    bris_place_id   text,
    content_hash    text NOT NULL,
    extracted_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cs_bris_raw_records IS
  'Layer 0 (BRONZE): 페이지에서 추출한 파서 dict 한 행 단위 보존. Layer 1 의 직접 입력.';
COMMENT ON COLUMN public.cs_bris_raw_records.payload IS
  '파서 출력 dict 원본(JSON). Layer 1 _upsert_* 가 이걸 입력으로 받음.';
COMMENT ON COLUMN public.cs_bris_raw_records.content_hash IS
  'payload SHA1. cs_courses/projects.last_content_hash 와 짝. 변경 없음 단축회로.';

CREATE INDEX IF NOT EXISTS idx_cs_bris_raw_records_page
    ON public.cs_bris_raw_records (page_id);
CREATE INDEX IF NOT EXISTS idx_cs_bris_raw_records_business
    ON public.cs_bris_raw_records (business_id) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cs_bris_raw_records_project
    ON public.cs_bris_raw_records (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cs_bris_raw_records_customer
    ON public.cs_bris_raw_records (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cs_bris_raw_records_hash
    ON public.cs_bris_raw_records (content_hash);

-- Section 3: Layer 1 lineage
ALTER TABLE public.cs_courses
    ADD COLUMN IF NOT EXISTS source_raw_record_id uuid
        REFERENCES public.cs_bris_raw_records(id) ON DELETE SET NULL;
ALTER TABLE public.cs_projects
    ADD COLUMN IF NOT EXISTS source_raw_record_id uuid
        REFERENCES public.cs_bris_raw_records(id) ON DELETE SET NULL;
ALTER TABLE public.cs_contacts
    ADD COLUMN IF NOT EXISTS source_raw_record_id uuid
        REFERENCES public.cs_bris_raw_records(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cs_courses.source_raw_record_id IS
  'Layer 0 lineage. 이 row 를 만든/마지막으로 갱신한 raw record. 감사/replay 용.';
COMMENT ON COLUMN public.cs_projects.source_raw_record_id IS
  'Layer 0 lineage. 이 row 를 만든/마지막으로 갱신한 raw record.';
COMMENT ON COLUMN public.cs_contacts.source_raw_record_id IS
  'Layer 0 lineage. 이 row 를 만든/마지막으로 갱신한 raw record.';

CREATE INDEX IF NOT EXISTS idx_cs_courses_source_raw
    ON public.cs_courses (source_raw_record_id) WHERE source_raw_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cs_projects_source_raw
    ON public.cs_projects (source_raw_record_id) WHERE source_raw_record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cs_contacts_source_raw
    ON public.cs_contacts (source_raw_record_id) WHERE source_raw_record_id IS NOT NULL;

-- Section 4: cs_import_errors lineage
ALTER TABLE public.cs_import_errors
    ADD COLUMN IF NOT EXISTS raw_record_id uuid
        REFERENCES public.cs_bris_raw_records(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cs_import_errors.raw_record_id IS
  '검수 격리된 row 의 Layer 0 출처. 파서/원본 추적 후 raw 에서 직접 수정/replay 가능.';

-- Section 5: RLS — service_role 전용 쓰기, authenticated 읽기 허용
ALTER TABLE public.cs_bris_raw_pages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_bris_raw_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                   AND tablename='cs_bris_raw_pages' AND policyname='raw_pages_service_role_all') THEN
        EXECUTE 'CREATE POLICY raw_pages_service_role_all ON public.cs_bris_raw_pages
                 FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                   AND tablename='cs_bris_raw_pages' AND policyname='raw_pages_authenticated_read') THEN
        EXECUTE 'CREATE POLICY raw_pages_authenticated_read ON public.cs_bris_raw_pages
                 FOR SELECT TO authenticated USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                   AND tablename='cs_bris_raw_records' AND policyname='raw_records_service_role_all') THEN
        EXECUTE 'CREATE POLICY raw_records_service_role_all ON public.cs_bris_raw_records
                 FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                   AND tablename='cs_bris_raw_records' AND policyname='raw_records_authenticated_read') THEN
        EXECUTE 'CREATE POLICY raw_records_authenticated_read ON public.cs_bris_raw_records
                 FOR SELECT TO authenticated USING (true)';
    END IF;
END $$;

-- Section 6: 진단 뷰
CREATE OR REPLACE VIEW public.v_cs_bris_lineage_health AS
SELECT
  (SELECT count(*) FROM public.cs_bris_raw_pages)                                    AS raw_pages_total,
  (SELECT count(*) FROM public.cs_bris_raw_records)                                  AS raw_records_total,
  (SELECT count(*) FROM public.cs_courses  WHERE source_raw_record_id IS NOT NULL)   AS courses_with_lineage,
  (SELECT count(*) FROM public.cs_courses  WHERE source_raw_record_id IS NULL)       AS courses_orphan,
  (SELECT count(*) FROM public.cs_projects WHERE source_raw_record_id IS NOT NULL)   AS projects_with_lineage,
  (SELECT count(*) FROM public.cs_projects WHERE source_raw_record_id IS NULL)       AS projects_orphan,
  (SELECT count(*) FROM public.cs_contacts WHERE source_raw_record_id IS NOT NULL)   AS contacts_with_lineage,
  (SELECT count(*) FROM public.cs_contacts WHERE source_raw_record_id IS NULL)       AS contacts_orphan;

COMMENT ON VIEW public.v_cs_bris_lineage_health IS
  'Layer 0 보유율 + Layer 1 lineage 채움률 한눈에. orphan 이 0 으로 수렴해야 공장 정상.';
