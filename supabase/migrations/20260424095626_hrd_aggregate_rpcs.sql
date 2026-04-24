-- HRD 통계·대시보드용 서버측 집계 RPC
-- 목적: JS 측 전체 로드 후 집계 → Postgres GROUP BY 로 이동
-- 근거: /admin/hrd/statistics, /admin/hrd/dashboard 페이지의 5초대 TTFB 해소

-- ──────────────────────────────────────────────
-- 1. 라운드 단위 전체 요약
-- ──────────────────────────────────────────────
create or replace function public.get_hrd_round_statistics(p_round_id uuid)
returns table (
  total_responses    bigint,
  unique_respondents bigint,
  unique_items       bigint,
  avg_score          numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint                              as total_responses,
    count(distinct respondent_id)::bigint         as unique_respondents,
    count(distinct item_id)::bigint               as unique_items,
    round(
      avg(value_number) filter (where value_number is not null)::numeric,
      2
    )                                             as avg_score
  from hrd_responses
  where round_id = p_round_id;
$$;

-- ──────────────────────────────────────────────
-- 2. 파트별 통계
-- ──────────────────────────────────────────────
create or replace function public.get_hrd_part_statistics(p_round_id uuid)
returns table (
  part_id        uuid,
  part_code      text,
  part_name      text,
  sort_order     int,
  response_count bigint,
  avg_score      numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id                                                 as part_id,
    p.part_code,
    p.part_name,
    p.sort_order,
    count(r.id)::bigint                                  as response_count,
    round(
      avg(r.value_number) filter (where r.value_number is not null)::numeric,
      2
    )                                                    as avg_score
  from hrd_survey_parts p
  left join hrd_survey_items i
    on i.part_id = p.id
  left join hrd_responses r
    on r.item_id = i.id
   and r.round_id = p_round_id
  where p.round_id = p_round_id
  group by p.id, p.part_code, p.part_name, p.sort_order
  order by p.sort_order asc;
$$;

-- ──────────────────────────────────────────────
-- 3. 응답자 요약 (대시보드용)
-- ──────────────────────────────────────────────
create or replace function public.get_hrd_respondent_summary(p_round_id uuid)
returns table (
  target_count     int,
  total_count      int,
  completed_count  int,
  in_progress_count int,
  invited_count    int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(max(rd.target_count), 0)                              as target_count,
    count(r.id)::int                                               as total_count,
    count(*) filter (where r.status = 'completed')::int            as completed_count,
    count(*) filter (where r.status = 'in_progress')::int          as in_progress_count,
    count(*) filter (where r.status = 'invited')::int              as invited_count
  from hrd_survey_rounds rd
  left join hrd_respondents r on r.round_id = rd.id
  where rd.id = p_round_id;
$$;

-- ──────────────────────────────────────────────
-- 4. 응답자 상태 분포 (대시보드 breakdown)
-- ──────────────────────────────────────────────
create or replace function public.get_hrd_respondent_breakdown(p_round_id uuid)
returns table (
  status text,
  cnt    bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select status, count(*)::bigint as cnt
  from hrd_respondents
  where round_id = p_round_id
  group by status
  order by cnt desc;
$$;

-- ──────────────────────────────────────────────
-- 인덱스 보강 (응답 집계 가속)
-- ──────────────────────────────────────────────
create index if not exists idx_hrd_responses_round_item
  on hrd_responses(round_id, item_id);

-- ──────────────────────────────────────────────
-- 권한
-- ──────────────────────────────────────────────
grant execute on function public.get_hrd_round_statistics(uuid)   to authenticated;
grant execute on function public.get_hrd_part_statistics(uuid)    to authenticated;
grant execute on function public.get_hrd_respondent_summary(uuid) to authenticated;
grant execute on function public.get_hrd_respondent_breakdown(uuid) to authenticated;
