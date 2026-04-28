-- =============================================================================
-- Migration: 자동화 foundation — feature flag + per-batch toggle + alert queue
-- Date:      2026-04-28
-- Context:
--   L1 (BRIS 자동 fetch + 월별 batch 자동 + 발송 자동) 도입의 토대.
--   모든 자동화 코드 경로(cron, 자동 dispatch)가 본 테이블/플래그를 참조하여
--   안전하게 ON/OFF + 한도 + 감사 로그 + 운영자 알림 가능.
-- =============================================================================


-- ------------------------------------------------------------------
-- 1. cs_automation_settings — 싱글턴 글로벌 설정
-- ------------------------------------------------------------------
-- id='global' 단일 행. 운영자가 cs_dashboard / 관리 UI 에서 직접 수정.
-- 기본은 모두 OFF — 명시적으로 ON 해야 자동화 작동 (안전 first).

create table if not exists public.cs_automation_settings (
    id text primary key default 'global',
    auto_dispatch_enabled boolean not null default false,
    daily_send_limit integer not null default 100,
    alert_email text,
    bris_fetch_cron text not null default '0 18 * * 0',     -- KST Sun 03:00 (UTC Sun 18:00)
    monthly_batch_cron text not null default '0 0 1 * *',   -- KST 1st 09:00 (UTC 1st 00:00)
    auto_dispatch_cron text not null default '0 1 * * *',   -- KST daily 10:00 (UTC 01:00)
    dry_run_default boolean not null default true,
    notes text,
    updated_at timestamptz not null default now(),
    updated_by text,
    constraint cs_automation_settings_singleton check (id = 'global')
);

comment on table public.cs_automation_settings is
    '자동화 글로벌 설정 — 단일 행(id=''global''). 모든 cron 과 자동 dispatch 경로가 참조. '
    '기본값 모두 보수적: auto_dispatch_enabled=false, dry_run_default=true, daily_send_limit=100.';
comment on column public.cs_automation_settings.auto_dispatch_enabled is
    '전역 kill switch. false 면 자동 dispatch cron 이 즉시 종료.';
comment on column public.cs_automation_settings.daily_send_limit is
    '하루 누적 자동 발송 건수 상한. 초과 시 cron 정지 + alert 적재.';
comment on column public.cs_automation_settings.dry_run_default is
    '신규 batch 의 auto_dispatch_mode 기본값을 dry_run 으로 강제 (즉시 on 방지).';

-- 초기 행 (이미 있으면 건너뜀)
insert into public.cs_automation_settings (id) values ('global')
on conflict (id) do nothing;


-- ------------------------------------------------------------------
-- 2. cs_target_batches.auto_dispatch_mode — per-batch 토글
-- ------------------------------------------------------------------
-- off / dry_run / on. 신규 batch 는 off 로 시작. 운영자가 명시적으로 dry_run → on 승격.

alter table public.cs_target_batches
    add column if not exists auto_dispatch_mode text not null default 'off';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cs_target_batches_auto_dispatch_mode_check'
  ) then
    alter table public.cs_target_batches
        add constraint cs_target_batches_auto_dispatch_mode_check
        check (auto_dispatch_mode in ('off', 'dry_run', 'on'));
  end if;
end $$;

comment on column public.cs_target_batches.auto_dispatch_mode is
    'batch 단위 자동 발송 모드. off=수동만, dry_run=미리보기만, on=cron 이 자동 호출. '
    '운영자가 cs_dashboard 에서 토글. 글로벌 auto_dispatch_enabled 와 AND 조건.';


-- ------------------------------------------------------------------
-- 3. cs_dispatch_attempts — 자동 dispatch 시도 audit log
-- ------------------------------------------------------------------
-- 자동 cron 이 dispatch 시도할 때마다 한 행 기록. 성공/실패/skip 사유 모두.
-- 사고 시 "왜 그때 발송됐는가" 추적 + 운영 신뢰 확보.

create table if not exists public.cs_dispatch_attempts (
    id uuid primary key default gen_random_uuid(),
    batch_id uuid references public.cs_target_batches(id) on delete cascade,
    attempted_at timestamptz not null default now(),
    mode text not null check (mode in ('dry_run', 'on')),
    candidates_count integer not null default 0,
    dispatched_count integer not null default 0,
    skipped_count integer not null default 0,
    errors_count integer not null default 0,
    daily_total_before integer,
    daily_total_after integer,
    daily_limit_at_attempt integer,
    reason text not null,        -- 'success' | 'limit_exceeded' | 'no_active_survey' | 'flag_off' | 'no_candidates' | 'error'
    response_payload jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_cs_dispatch_attempts_batch on public.cs_dispatch_attempts (batch_id);
create index if not exists idx_cs_dispatch_attempts_recent on public.cs_dispatch_attempts (attempted_at desc);
create index if not exists idx_cs_dispatch_attempts_reason on public.cs_dispatch_attempts (reason);

comment on table public.cs_dispatch_attempts is
    '자동 dispatch cron 시도 audit log. 성공/실패/skip 모두 기록. '
    'fn_cs_automation_count_today_sends() 의 입력 소스.';


-- ------------------------------------------------------------------
-- 4. cs_dispatch_alerts — 알림 큐
-- ------------------------------------------------------------------
-- BRIS fetch 실패, daily_send_limit 초과, no_active_survey, 자동 모드 OFF 등
-- 이상 신호를 운영자에게 알릴 메시지 큐. 이메일 worker(PR-Auto-5)가 소비.

create table if not exists public.cs_dispatch_alerts (
    id uuid primary key default gen_random_uuid(),
    severity text not null check (severity in ('info', 'warn', 'error')),
    source text not null,       -- 'bris_fetch' | 'monthly_batch' | 'auto_dispatch' | 'manual'
    subject text not null,
    body text,
    context jsonb,
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'suppressed')),
    sent_at timestamptz,
    failed_reason text,
    created_at timestamptz not null default now()
);

create index if not exists idx_cs_dispatch_alerts_pending
    on public.cs_dispatch_alerts (created_at)
    where status = 'pending';
create index if not exists idx_cs_dispatch_alerts_recent
    on public.cs_dispatch_alerts (created_at desc);

comment on table public.cs_dispatch_alerts is
    '자동화 이상 신호 알림 큐. PR-Auto-5 의 이메일 worker 가 status=pending 행을 처리.';


-- ------------------------------------------------------------------
-- 5. RLS — service_role 만 쓰기, authenticated 는 읽기
-- ------------------------------------------------------------------

alter table public.cs_automation_settings enable row level security;
alter table public.cs_dispatch_attempts enable row level security;
alter table public.cs_dispatch_alerts enable row level security;

do $$
begin
  -- cs_automation_settings: service_role 전권, authenticated 는 select only
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cs_automation_settings' and policyname='cs_auto_settings_service_all') then
    create policy "cs_auto_settings_service_all" on public.cs_automation_settings
      for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cs_automation_settings' and policyname='cs_auto_settings_auth_select') then
    create policy "cs_auto_settings_auth_select" on public.cs_automation_settings
      for select to authenticated using (true);
  end if;

  -- cs_dispatch_attempts: service_role 만
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cs_dispatch_attempts' and policyname='cs_dispatch_attempts_service_all') then
    create policy "cs_dispatch_attempts_service_all" on public.cs_dispatch_attempts
      for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cs_dispatch_attempts' and policyname='cs_dispatch_attempts_auth_select') then
    create policy "cs_dispatch_attempts_auth_select" on public.cs_dispatch_attempts
      for select to authenticated using (true);
  end if;

  -- cs_dispatch_alerts: service_role 만
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cs_dispatch_alerts' and policyname='cs_dispatch_alerts_service_all') then
    create policy "cs_dispatch_alerts_service_all" on public.cs_dispatch_alerts
      for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cs_dispatch_alerts' and policyname='cs_dispatch_alerts_auth_select') then
    create policy "cs_dispatch_alerts_auth_select" on public.cs_dispatch_alerts
      for select to authenticated using (true);
  end if;
end $$;


-- ------------------------------------------------------------------
-- 6. Helper RPCs
-- ------------------------------------------------------------------

-- 6.1 글로벌 설정 조회 (service_role bypass RLS)
create or replace function public.fn_cs_automation_get_settings()
returns public.cs_automation_settings
language sql
security definer
set search_path = public
as $$
  select * from public.cs_automation_settings where id = 'global' limit 1;
$$;
comment on function public.fn_cs_automation_get_settings() is
    '자동화 글로벌 설정 1행 조회. cron 과 dispatch 경로의 공통 입력.';


-- 6.2 오늘 자동 발송 누적 건수 (KST 기준)
create or replace function public.fn_cs_automation_count_today_sends()
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(dispatched_count), 0)::integer
  from public.cs_dispatch_attempts
  where mode = 'on'
    and attempted_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;
comment on function public.fn_cs_automation_count_today_sends() is
    'KST 자정 ~ 현재까지 자동 발송된 건수 누적. daily_send_limit 비교용.';


-- 6.3 알림 큐 적재
create or replace function public.fn_cs_automation_enqueue_alert(
    p_severity text,
    p_source text,
    p_subject text,
    p_body text default null,
    p_context jsonb default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.cs_dispatch_alerts (severity, source, subject, body, context)
  values (p_severity, p_source, p_subject, p_body, p_context)
  returning id;
$$;
comment on function public.fn_cs_automation_enqueue_alert is
    '운영자 알림 큐에 1건 적재. PR-Auto-5 의 이메일 worker 가 비동기 처리.';


-- 6.4 dispatch 시도 기록
create or replace function public.fn_cs_automation_log_attempt(
    p_batch_id uuid,
    p_mode text,
    p_candidates int,
    p_dispatched int,
    p_skipped int,
    p_errors int,
    p_daily_before int,
    p_daily_after int,
    p_daily_limit int,
    p_reason text,
    p_response jsonb default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.cs_dispatch_attempts (
    batch_id, mode, candidates_count, dispatched_count, skipped_count, errors_count,
    daily_total_before, daily_total_after, daily_limit_at_attempt, reason, response_payload
  ) values (
    p_batch_id, p_mode, p_candidates, p_dispatched, p_skipped, p_errors,
    p_daily_before, p_daily_after, p_daily_limit, p_reason, p_response
  )
  returning id;
$$;
comment on function public.fn_cs_automation_log_attempt is
    '자동 dispatch 시도를 audit log 에 1건 기록.';


-- 6.5 자동화 상태 한눈 조회 뷰
create or replace view public.v_cs_automation_status as
select
    s.auto_dispatch_enabled,
    s.daily_send_limit,
    s.dry_run_default,
    s.bris_fetch_cron,
    s.monthly_batch_cron,
    s.auto_dispatch_cron,
    public.fn_cs_automation_count_today_sends() as today_dispatched,
    s.daily_send_limit - public.fn_cs_automation_count_today_sends() as today_remaining,
    (select count(*) from public.cs_target_batches where auto_dispatch_mode = 'on') as batches_auto_on,
    (select count(*) from public.cs_target_batches where auto_dispatch_mode = 'dry_run') as batches_dry_run,
    (select count(*) from public.cs_dispatch_alerts where status = 'pending') as alerts_pending,
    (select max(attempted_at) from public.cs_dispatch_attempts) as last_attempt_at
from public.cs_automation_settings s
where s.id = 'global';

comment on view public.v_cs_automation_status is
    'cs_dashboard / 관리 UI 의 자동화 패널 1행 조회용. 운영자가 한눈에 ON/OFF/한도/큐 상태 파악.';


-- ------------------------------------------------------------------
-- 7. grant (authenticated 가 view/RPC select 가능하도록)
-- ------------------------------------------------------------------

grant select on public.v_cs_automation_status to authenticated, anon;
grant execute on function public.fn_cs_automation_get_settings() to authenticated;
grant execute on function public.fn_cs_automation_count_today_sends() to authenticated;
