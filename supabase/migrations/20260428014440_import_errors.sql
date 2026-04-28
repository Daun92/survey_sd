-- =============================================================================
-- Migration: BRIS 수집 실패 레코드 격리 테이블
-- Date:      2026-04-21
-- Context:
--   bris_to_supabase.py 가 적재 전 필수 필드(business_id/project_id/place_id/
--   customer_id/수주코드/과정명/고객_담당자) 결측을 검증한 뒤, 실패 레코드의
--   raw snapshot 을 이 테이블로 격리하기 위함. 운영자가 사후 검토하여 파서
--   또는 원본 데이터 이슈를 추적할 수 있음.
-- =============================================================================

create table if not exists public.cs_import_errors (
    id uuid primary key default gen_random_uuid(),
    sync_id uuid,
    bris_code text,
    raw_row jsonb not null,
    missing_fields text[] not null default '{}',
    reason text,
    created_at timestamptz not null default now()
);

comment on table public.cs_import_errors is
  'BRIS → Supabase 적재 전 검증 실패 레코드. bris_to_supabase.py:sync_records() 의 validation gate 산물.';
comment on column public.cs_import_errors.sync_id is
  'cs_sync_logs.id 와 대응. fn_cs_sync_start 가 반환한 값.';
comment on column public.cs_import_errors.raw_row is
  '파서 출력 dict 원본(JSON). 필요 시 이 값만으로 재적재 가능해야 함.';
comment on column public.cs_import_errors.missing_fields is
  'validation gate 가 비어있다고 판단한 필수 필드 목록.';

create index if not exists idx_cs_import_errors_sync on public.cs_import_errors (sync_id);
create index if not exists idx_cs_import_errors_bris_code on public.cs_import_errors (bris_code);
create index if not exists idx_cs_import_errors_created on public.cs_import_errors (created_at desc);
