-- 관리자 대시보드(/admin) 집계 RPC
-- 목적:
--   1. edu_submissions.select("survey_id") 풀스캔 제거 → GROUP BY 로 서버 집계
--   2. distributions 전체 로드 제거 → survey_id 별 status 집계 RPC 로 대체

-- ──────────────────────────────────────────────
-- 1. 설문별 응답 수 (is_test=false)
-- ──────────────────────────────────────────────
create or replace function public.edu_submission_counts_by_survey()
returns table (
  survey_id uuid,
  cnt       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select survey_id, count(*)::bigint as cnt
  from edu_submissions
  where is_test = false
    and survey_id is not null
  group by survey_id;
$$;

-- ──────────────────────────────────────────────
-- 2. 설문별 배포 상태 집계
--    p_since 이후 생성된 배포만 집계 (기본 60일).
--    대시보드 카드/알림은 최근 배포 기반으로 충분하며,
--    전체 기간 조회는 불필요한 I/O 유발.
-- ──────────────────────────────────────────────
create or replace function public.distribution_aggregates_by_survey(
  p_since timestamptz default (now() - interval '60 days')
)
returns table (
  survey_id       uuid,
  total           bigint,
  pending         bigint,
  opened          bigint,
  started         bigint,
  completed       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    survey_id,
    count(*)::bigint                                     as total,
    count(*) filter (where status = 'pending')::bigint   as pending,
    count(*) filter (where status = 'opened')::bigint    as opened,
    count(*) filter (where status = 'started')::bigint   as started,
    count(*) filter (where status = 'completed')::bigint as completed
  from distributions
  where created_at >= p_since
    and survey_id is not null
  group by survey_id;
$$;

-- ──────────────────────────────────────────────
-- 인덱스 보강
-- ──────────────────────────────────────────────
create index if not exists idx_edu_submissions_survey_nontest
  on edu_submissions(survey_id)
  where is_test = false;

create index if not exists idx_distributions_survey_status
  on distributions(survey_id, status);

create index if not exists idx_distributions_created_at_desc
  on distributions(created_at desc);

-- ──────────────────────────────────────────────
-- 권한
-- ──────────────────────────────────────────────
grant execute on function public.edu_submission_counts_by_survey() to authenticated;
grant execute on function public.distribution_aggregates_by_survey(timestamptz) to authenticated;
