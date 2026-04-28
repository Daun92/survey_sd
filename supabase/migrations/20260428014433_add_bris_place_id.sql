-- =============================================================================
-- Migration: cs_business_places.bris_place_id 컬럼 실제 추가
-- Date:      2026-04-21
-- Context:
--   20260415_enhance_auto_batch.sql 이 DRAFT 로 남아 ADD COLUMN 이 실제로
--   실행되지 않았음을 2026-04-21 진단 쿼리에서 확인. 현재 운영 코드(bris_to_supabase.py)
--   가 이 컬럼을 canonical upsert key 로 사용하도록 고쳐졌으므로, 컬럼을 먼저
--   확실히 추가하고 인덱스를 건다. 데이터 검증은 이후 진단 쿼리에서 진행.
-- =============================================================================

alter table public.cs_business_places
    add column if not exists bris_place_id text;

comment on column public.cs_business_places.bris_place_id is
  'BRIS 사업장 고유 ID. data_model_v2.md:755-761 canonical key. '
  'bris_to_supabase.py:_upsert_place() 가 조회·기록.';

create index if not exists idx_cs_business_places_bris_place_id
    on public.cs_business_places (bris_place_id)
    where bris_place_id is not null;
