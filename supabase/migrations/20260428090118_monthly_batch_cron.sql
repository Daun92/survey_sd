-- =============================================================================
-- Migration: 월별 batch 자동 생성 cron (C1, PR-Auto-3) — v1 초기 적용본
-- Date:      2026-04-28
-- Status:    SUPERSEDED by 20260428090307_monthly_batch_cron_v2.sql
-- Context:
--   v1 은 edu_surveys.template_type / is_active 컬럼을 가정하고 작성됐으나
--   실제 스키마는 survey_type / status 만 존재 (cs-bridge route 와 README 의
--   메타데이터 mismatch 가 원인). v1 적용 직후 바로 v2 에서 수정. v2 의
--   CREATE OR REPLACE FUNCTION 이 본 파일의 fn_cs_cron_monthly_batch 를
--   덮어씀. 본 파일의 의의는 cron.schedule 등록(jobid=4, '0 0 1 * *').
--
--   진실원: 본 파일 + v2 두 개 모두 supabase_migrations 에 존재하므로
--   재현 시 둘 다 순서대로 apply 해야 운영 상태와 동일.
-- =============================================================================

create or replace function public.fn_cs_cron_monthly_batch()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_settings public.cs_automation_settings;
    v_period_start date;
    v_period_end   date;
    v_batch_name   text;
    v_existing     uuid;
    v_active_count int;
    v_batch_id     uuid;
    v_candidates   int;
    v_new_mode     text;
    v_alert_id     uuid;
begin
    select * into v_settings from public.cs_automation_settings where id = 'global';

    v_period_start := (date_trunc('month', (now() at time zone 'Asia/Seoul') - interval '1 month'))::date;
    v_period_end   := (date_trunc('month', (now() at time zone 'Asia/Seoul'))::date - interval '1 day')::date;
    v_batch_name   := to_char(v_period_start, 'YYYY-MM');

    select id into v_existing
    from public.cs_target_batches
    where target_period_start = v_period_start
      and target_period_end   = v_period_end
    order by created_at desc
    limit 1;

    if v_existing is not null then
        v_alert_id := public.fn_cs_automation_enqueue_alert(
            'info', 'monthly_batch',
            format('월별 batch 자동 생성 스킵 — 이미 존재: %s', v_batch_name),
            null,
            jsonb_build_object('existing_batch_id', v_existing, 'period_start', v_period_start, 'period_end', v_period_end)
        );
        return jsonb_build_object(
            'status', 'skipped',
            'reason', 'already_exists',
            'existing_batch_id', v_existing,
            'batch_name', v_batch_name,
            'alert_id', v_alert_id
        );
    end if;

    -- ⚠ v1 의 버그: 실제 edu_surveys 스키마엔 template_type / is_active 가 없음
    --   v2 에서 survey_type='cs_satisfaction' / status='active' 로 정정.
    select count(*)::int into v_active_count
    from public.edu_surveys
    where template_type = 's1_cs' and is_active = true;

    if v_active_count = 0 then
        v_alert_id := public.fn_cs_automation_enqueue_alert(
            'warn', 'monthly_batch',
            format('active s1_cs 설문 없음 — %s batch dispatch 시 실패할 수 있음', v_batch_name),
            'survey_sd /admin 에서 s1_cs 템플릿 기반 설문을 1건 이상 활성 상태로 준비 필요.',
            jsonb_build_object('batch_name', v_batch_name)
        );
    end if;

    select batch_id, candidates_added
      into v_batch_id, v_candidates
      from public.fn_cs_create_batch_and_scan(
          v_batch_name,
          v_period_start,
          v_period_end,
          'cron:monthly_batch'
      );

    v_new_mode := case when v_settings.dry_run_default then 'dry_run' else 'off' end;
    update public.cs_target_batches
       set auto_dispatch_mode = v_new_mode
     where id = v_batch_id;

    v_alert_id := public.fn_cs_automation_enqueue_alert(
        'info', 'monthly_batch',
        format('월별 batch 자동 생성 완료 — %s (후보 %s건, mode=%s)', v_batch_name, v_candidates, v_new_mode),
        null,
        jsonb_build_object(
            'batch_id', v_batch_id,
            'batch_name', v_batch_name,
            'period_start', v_period_start,
            'period_end', v_period_end,
            'candidates', v_candidates,
            'auto_dispatch_mode', v_new_mode,
            'active_s1_cs_count', v_active_count
        )
    );

    return jsonb_build_object(
        'status', 'created',
        'batch_id', v_batch_id,
        'batch_name', v_batch_name,
        'period_start', v_period_start,
        'period_end', v_period_end,
        'candidates', v_candidates,
        'auto_dispatch_mode', v_new_mode,
        'active_s1_cs_count', v_active_count,
        'alert_id', v_alert_id
    );

exception when others then
    perform public.fn_cs_automation_enqueue_alert(
        'error', 'monthly_batch',
        format('월별 batch 자동 생성 실패: %s', sqlstate),
        sqlerrm,
        jsonb_build_object('period_start', v_period_start, 'period_end', v_period_end, 'batch_name', v_batch_name)
    );
    raise;
end;
$$;

comment on function public.fn_cs_cron_monthly_batch() is
    '매월 1일 KST 09:00 자동 실행. 직전월 기간으로 cs_target_batches 1건 생성 + 후보 스캔. '
    'cs_automation_settings.dry_run_default 에 따라 auto_dispatch_mode=dry_run/off 초기 설정. '
    'active s1_cs 설문 0건 시 warn alert. 동일 기간 batch 존재 시 스킵 (idempotent).';

grant execute on function public.fn_cs_cron_monthly_batch() to service_role;


-- ------------------------------------------------------------------
-- pg_cron 등록 — 매월 1일 KST 09:00 (UTC 매월 1일 00:00)
-- ------------------------------------------------------------------

do $$
declare
    v_jobid bigint;
begin
    select jobid into v_jobid from cron.job where jobname = 'cs_monthly_batch';
    if v_jobid is not null then
        perform cron.unschedule(v_jobid);
    end if;
    perform cron.schedule(
        'cs_monthly_batch',
        '0 0 1 * *',
        $cron$ SELECT public.fn_cs_cron_monthly_batch(); $cron$
    );
end $$;
