-- =============================================================================
-- Migration: 월별 batch 자동 생성 cron — v2 (edu_surveys 실제 스키마 정렬)
-- Date:      2026-04-28
-- Context:
--   v1 (20260428090118) 은 edu_surveys.template_type / is_active 컬럼을
--   가정했으나 실제 스키마는 survey_type / status 만 존재.
--   CS 설문은 survey_type='cs_satisfaction'.
--   v2 는 active cs_satisfaction 설문이 1건이면 batch.survey_id 에 자동
--   할당, 0/다수면 운영자 검토용 warn alert 적재.
--   pg_cron 등록은 v1 에서 이미 처리됨 (jobid=4) — 본 파일은 함수만 교체.
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
    v_active_survey_id uuid;
    v_batch_id     uuid;
    v_candidates   int;
    v_new_mode     text;
    v_alert_id     uuid;
begin
    select * into v_settings from public.cs_automation_settings where id = 'global';

    -- 직전월 (KST 기준)
    v_period_start := (date_trunc('month', (now() at time zone 'Asia/Seoul') - interval '1 month'))::date;
    v_period_end   := (date_trunc('month', (now() at time zone 'Asia/Seoul'))::date - interval '1 day')::date;
    v_batch_name   := to_char(v_period_start, 'YYYY-MM');

    -- 동일 기간 batch 존재 시 스킵
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

    -- active cs_satisfaction 설문 조회
    select count(*)::int into v_active_count
    from public.edu_surveys
    where survey_type = 'cs_satisfaction' and status = 'active';

    if v_active_count = 1 then
        select id into v_active_survey_id
        from public.edu_surveys
        where survey_type = 'cs_satisfaction' and status = 'active'
        limit 1;
    elsif v_active_count = 0 then
        v_alert_id := public.fn_cs_automation_enqueue_alert(
            'warn', 'monthly_batch',
            format('active cs_satisfaction 설문 없음 — %s batch 의 survey_id 미할당', v_batch_name),
            'survey_sd /admin 에서 cs_satisfaction 설문 1건을 active 로 준비 필요. dispatch 시 cs-bridge 가 batch.survey_id 부재로 거부.',
            jsonb_build_object('batch_name', v_batch_name)
        );
    else
        v_alert_id := public.fn_cs_automation_enqueue_alert(
            'warn', 'monthly_batch',
            format('active cs_satisfaction 설문 다수(%s건) — %s batch.survey_id 자동 할당 보류', v_active_count, v_batch_name),
            '운영자가 cs_target_batches.survey_id 를 명시 선택해야 함.',
            jsonb_build_object('batch_name', v_batch_name, 'active_count', v_active_count)
        );
    end if;

    -- batch 생성 + 후보 스캔
    select batch_id, candidates_added
      into v_batch_id, v_candidates
      from public.fn_cs_create_batch_and_scan(
          v_batch_name,
          v_period_start,
          v_period_end,
          'cron:monthly_batch'
      );

    -- auto_dispatch_mode 초기 설정 + survey_id 자동 할당 (1건만)
    v_new_mode := case when v_settings.dry_run_default then 'dry_run' else 'off' end;
    update public.cs_target_batches
       set auto_dispatch_mode = v_new_mode,
           survey_id = coalesce(v_active_survey_id, survey_id)
     where id = v_batch_id;

    v_alert_id := public.fn_cs_automation_enqueue_alert(
        'info', 'monthly_batch',
        format('월별 batch 자동 생성 완료 — %s (후보 %s건, mode=%s, survey_id=%s)',
               v_batch_name, v_candidates, v_new_mode,
               coalesce(v_active_survey_id::text, 'NULL')),
        null,
        jsonb_build_object(
            'batch_id', v_batch_id,
            'batch_name', v_batch_name,
            'period_start', v_period_start,
            'period_end', v_period_end,
            'candidates', v_candidates,
            'auto_dispatch_mode', v_new_mode,
            'survey_id', v_active_survey_id,
            'active_cs_satisfaction_count', v_active_count
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
        'survey_id', v_active_survey_id,
        'active_cs_satisfaction_count', v_active_count,
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
    'cs_automation_settings.dry_run_default 에 따라 auto_dispatch_mode=dry_run/off 설정. '
    'active cs_satisfaction 설문 1건 시 batch.survey_id 자동 할당, 0/다수 시 warn alert.';
