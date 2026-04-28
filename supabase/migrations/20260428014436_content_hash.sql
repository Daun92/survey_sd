-- =============================================================================
-- Migration: cs_projects / cs_courses 의 content hash 컬럼
-- Date:      2026-04-21
-- Context:
--   BRIS 재수집 시 내용이 동일하면 UPDATE 를 skip 하기 위한 short-circuit.
--   _upsert_project / _upsert_course 가 정규화된 레코드 dict 의 SHA1 을 계산해
--   저장한다. 값이 일치하면 updated_at / bris_synced_at 포함 모든 컬럼 UPDATE
--   를 생략. 결과적으로 updated_at 이 "실제로 데이터가 바뀐 시점"을 의미하게 됨.
-- =============================================================================

alter table public.cs_courses
    add column if not exists last_content_hash text;

alter table public.cs_projects
    add column if not exists last_content_hash text;

comment on column public.cs_courses.last_content_hash is
  'bris_to_supabase.py:_upsert_course() 가 계산한 SHA1. 변경 없음 감지용.';
comment on column public.cs_projects.last_content_hash is
  'bris_to_supabase.py:_upsert_project() 가 계산한 SHA1. 변경 없음 감지용.';

create index if not exists idx_cs_courses_content_hash
    on public.cs_courses (last_content_hash)
    where last_content_hash is not null;

create index if not exists idx_cs_projects_content_hash
    on public.cs_projects (last_content_hash)
    where last_content_hash is not null;
