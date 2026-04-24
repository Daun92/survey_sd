-- 관리자 사이드바 배지용 단일 RPC
-- 목적: admin layout 에서 실행되던 3개의 count:exact 쿼리를 1회 왕복으로 단축

create or replace function public.get_admin_sidebar_badges()
returns table (
  active_surveys   int,
  recent_responses int,
  failed_emails    int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from edu_surveys where status = 'active')        as active_surveys,
    (select count(*)::int
       from edu_submissions
      where is_test = false
        and submitted_at >= (now() - interval '24 hours'))                  as recent_responses,
    (select count(*)::int from distributions where status = 'failed')      as failed_emails;
$$;

grant execute on function public.get_admin_sidebar_badges() to authenticated;
