# L1 자동화 운영 활성 로드맵

작성: 2026-04-29 (코드 5개 PR #130~#134 머지 직후)

> **현재 상태**: 코드 안착 완료, 자동화 모두 OFF (전역 + 모든 batch). 본 문서는 **사람 결정 + 외부 시스템 점검 + 점진 활성** 단계를 박제. 다음 세션에서 본 문서를 진실원으로 이어 진행.

---

## 0. 한 페이지 요약

```
Stage 0 ── 사전 점검 ──────── 의사결정 5건 + active cs_satisfaction 설문 + Vercel env 확인
   │
Stage 1 ── Soft launch ─────── auto_dispatch_enabled=true, 1개 batch dry_run, 발송 X (1~2주)
   │   ↓ (검토 게이트)
Stage 2 ── 실발송 시범 ──────── daily_send_limit=5, batch 1개 'on', 5명 실발송 (1~2주)
   │   ↓ (검토 게이트)
Stage 3 ── 정상 운영 ─────────── daily_send_limit=100, 월별 routine
   │
Stage 4 ── 안정기 후 고도화 ───── L2 검토 자동, 다중 알림, 자동 배제 정책 확장
```

전역 OFF 스위치: `UPDATE cs_automation_settings SET auto_dispatch_enabled=false WHERE id='global'` (사고 시 즉시).

---

## 1. Stage 0 — 사전 점검 (지금 즉시 가능)

### 1-1. 외부 의존성 점검

| 항목 | 어디서 | 결과물 |
|---|---|---|
| Vercel env: `CRON_SECRET`, `CS_BRIDGE_API_KEY`, `NEXT_PUBLIC_APP_URL` | Vercel Dashboard → exc-survey → Settings → Env | 존재 여부 체크리스트 |
| Vercel env: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | 동일 | 동일 |
| 사내 Docker 호스트의 `bris_cron_runner.sh` crontab | 사내 호스트 `crontab -l` | 매주 일 KST 03:00 등록 여부 |
| BRIS 세션 쿠키/자격증명 유효성 | `secrets/bris_cookies.json` 또는 `BRIS_USER_ID/PASSWORD` | 마지막 sync 성공 여부 (`cs_sync_logs` 최근 행) |

### 1-2. **active cs_satisfaction 설문 1건 준비** (가장 큰 블로커)

현재 운영 DB:

```sql
SELECT survey_type, status, count(*)
FROM edu_surveys GROUP BY 1,2;
-- cs_satisfaction | closed | 1
-- s2_edu_post     | active | 2
-- s2_edu_post     | closed | 5
```

→ **active cs_satisfaction = 0**. 어떤 자동화도 발송까지 못 도달.

**작업**: survey_sd `/admin` 에서 `cs_satisfaction` 템플릿 기반 설문 1건 생성 + `status='active'`.

### 1-3. 의사결정 5건

| # | 항목 | 선택지 | 권장 | 업무적 영향 |
|---|---|---|---|---|
| 1 | alert_email 수신자 | 1인 / 공유 메일링 / 둘 다 | `htry2528@gmail.com` 우선, 향후 공유 메일링 추가 | 부재 시 도달 안 될 가능성 |
| 2 | Stage 1~2 의 daily_send_limit | 5 / 20 / 50 / 100 | **5** (Stage 1 dry_run 은 한도 무관) | 사고 시 폭발 반경 |
| 3 | dry_run 기간 | 1주 / 2주 / 1달 | **1~2주** | 데이터 패턴 확인 충분성 |
| 4 | email_providers 기본값 | HiWorks / Gmail SMTP / Outlook SMTP / 환경변수 fallback | 기존 운영 발신 수단 우선 (대개 HiWorks) | 발신 도메인 신뢰도, 도달률 |
| 5 | BRIS fetch 주기 | 매일 / 주1회 (현 기본) / 월2회 | 주1회 유지 (변경 명분 약함) | 데이터 신선도 vs BRIS 부하 |

### 1-4. Stage 0 산출물 — 게이트

- [ ] 외부 의존성 5개 모두 OK
- [ ] active cs_satisfaction 설문 1건 존재
- [ ] 의사결정 5건 합의

위 3개 모두 만족해야 Stage 1 진입.

---

## 2. Stage 1 — Soft launch (dry_run, 발송 X)

### 2-1. 글로벌 enable + 알림 수신자

```sql
UPDATE cs_automation_settings
   SET auto_dispatch_enabled = true,
       alert_email           = '<Stage 0 1번 결정값>',
       daily_send_limit      = <Stage 0 2번 결정값>,
       dry_run_default       = true
 WHERE id = 'global';
```

### 2-2. email_providers 의 `is_default=true` 행 확보

```sql
SELECT id, name, provider_type, from_email, is_default FROM email_providers;
```

없으면 survey_sd `/admin/settings` 에서 추가 또는 직접 INSERT.

### 2-3. 1개 batch 를 dry_run 으로

```sql
-- 검증 후보 batch 확인
SELECT id, batch_name, total_candidates, survey_id, auto_dispatch_mode
FROM cs_target_batches WHERE survey_id IS NOT NULL ORDER BY created_at DESC;

UPDATE cs_target_batches
   SET auto_dispatch_mode = 'dry_run'
 WHERE id = '<선택된 batch id>';
```

### 2-4. 다음날 KST 10:00 / 11:00 cron 결과 확인

| 어디서 | 무엇을 |
|---|---|
| `cs_dispatch_attempts` | mode='dry_run', reason='success', `response_payload->>'preview'` 의 5명 명단 |
| `cs_dispatch_alerts` | 'monthly_batch'/'auto_dispatch' source 알림 도달 여부 |
| 운영자 메일함 | KST 11:00 발송된 자동화 알림 도착 |
| `v_cs_automation_status` | today_dispatched=0 (dry_run 누적 X), alerts_pending 0 (모두 sent 또는 사람 검토 처리) |

### 2-5. Stage 1 산출물 (1~2주 후)

- dry_run 7~14일치 결과
- 후보 명단의 정확성 검증 (운영자가 수동 골라낼 명단과 일치?)
- alert 이메일 도달 정상

### 2-6. 검토 게이트 → Stage 2

조건:
- [ ] 후보 명단 정확
- [ ] alert 이메일 도달
- [ ] 외부망 차단/팀빌딩 등 echo_exclude_reason 자동 배제 정책 확장 필요한지 결정

만족 안 되면 정책 보강 후 dry_run 재돌립.

---

## 3. Stage 2 — 실발송 시범 (소량)

### 3-1. daily_send_limit 의도적 축소

```sql
UPDATE cs_automation_settings SET daily_send_limit = 5 WHERE id='global';
```

### 3-2. 검증 통과 batch 1개를 'on' 으로

```sql
UPDATE cs_target_batches
   SET auto_dispatch_mode = 'on'
 WHERE id = '<검증된 batch id>';
```

### 3-3. 다음 cron 후 확인

| 어디서 | 무엇을 |
|---|---|
| `cs_dispatch_attempts` | mode='on', dispatched=5, daily_total_after=5 |
| `distributions` | 5건 신규 (batch.survey_id 와 연결) |
| `email_queue` | 5건 status='pending' → 18:00 cron 후 'sent' |
| **실제 수신함** | 5명 중 본인이 받은 메일 확인 |
| `cs_dispatch_alerts` | "daily_send_limit 도달" warn (5건 도달 후) |

### 3-4. 응답 회수 확인 (1~2주)

| 어디서 | 무엇을 |
|---|---|
| `respondents` | 응답한 사람 행 |
| `edu_submissions` | 답변 |
| `cs_survey_targets.dispatched_at` | writeback 정상 |

### 3-5. Stage 2 산출물

- 5명 실발송 → 응답률
- 메일 도달 (스팸함 분류 X)
- alert 이메일 정상 도달

### 3-6. 검토 게이트 → Stage 3

조건:
- [ ] 응답률이 옛 수동 발송과 비슷
- [ ] 스팸 분류 안 됨
- [ ] 사고 없이 운영 가능

문제 시 즉시 OFF: `UPDATE cs_automation_settings SET auto_dispatch_enabled=false`.

---

## 4. Stage 3 — 정상 운영 (월별 routine)

### 4-1. 한도 복귀

```sql
UPDATE cs_automation_settings SET daily_send_limit = 100 WHERE id='global';
```

### 4-2. 월별 운영자 routine

매월 1일 KST 09:01 ~ :

1. `cs_dispatch_alerts` 이메일에서 "월별 batch 자동 생성 완료" 확인
2. cs_dashboard.html 에서 새 batch (직전월) 후보 검토
3. step5_confirmed 토글 + 운영자 보정
4. `auto_dispatch_mode='on'` 으로 토글 (또는 dry_run 1일 후 on)
5. 다음날 KST 10:00 자동 발송, KST 11:00 결과 알림

### 4-3. Stage 3 산출물

- 월별 운영자 부담: "검토 + 토글" 만 (수동 발송 클릭 X)
- 자동 발송 audit log 누적

---

## 5. Stage 4 — 안정기 후 고도화 (선택)

| 영역 | 내용 |
|---|---|
| L2 검토 자동화 | step5 자동 confirm 정책 (예: pending 3일 + 부적격 신호 X → 자동 confirm) |
| 다중 알림 채널 | Slack / 카카오 추가 |
| 자동 배제 정책 확장 | 외부망 차단 / 팀빌딩 등도 자동 배제 (운영팀 합의 후) |
| 자동화 대시보드 | cs_dashboard.html 또는 survey_sd /admin 에 `v_cs_automation_status` 시각화 |
| supabase gen types CLI 배너 영구 fix | `--no-update-check` 또는 tail trim |
| BRIS 세션 자동 갱신 | bris_api login flow 보강 |
| 사고 시뮬레이션 | feature flag OFF 훈련 + 롤백 절차 검증 |
| `v_cs_step_funnel` 신설 | 자동 배제율 99.5% 같은 이상치 즉시 시각화 |

---

## 6. OFF 절차 (사고/이상 시 즉시)

### 6-1. 글로벌

```sql
UPDATE cs_automation_settings SET auto_dispatch_enabled=false WHERE id='global';
```

다음 cron 호출 시점부터 즉시 정지 (시간 격차 = 최대 24시간).

### 6-2. 특정 batch 만

```sql
UPDATE cs_target_batches SET auto_dispatch_mode='off' WHERE id='...';
```

### 6-3. 이미 발송된 건은 어떻게?

자동/수동 dispatch 모두 `distributions + email_queue/sms_queue` 에 적재됨.
- 18:00 cron 전 큐 정리: `UPDATE email_queue SET status='cancelled' WHERE distribution_id IN (...)`
- 큐가 이미 보낸 후엔 회수 불가 (이메일 특성)

→ **최대 폭발 반경 = `daily_send_limit` 1일치**. 이게 한도를 보수적으로 설정해야 하는 이유.

---

## 7. 자동화 cron 시각표 (전체 ON 시)

| KST | cron | 위치 |
|---|---|---|
| 일 03:00 | BRIS auto-fetch (`bris_cron_runner.sh` → `bris_to_supabase.py cron`) | 사내 Docker 호스트 crontab |
| 매일 07:00 / 08:00, 일 23:00 | step4_recheck / lineage_audit / raw_retention | pg_cron jobid=1,2,3 |
| 매월 1일 09:00 | `fn_cs_cron_monthly_batch` (직전월 batch + 후보 스캔) | pg_cron jobid=4 |
| 매일 10:00 | `/api/cron/auto-dispatch` (dry_run/on dispatch) | Vercel cron |
| 매일 11:00 | `/api/cron/dispatch-alerts` (이메일 발송) | Vercel cron |
| 매일 18:00 | `/api/cron/send-emails` (email_queue) | Vercel cron (기존) |
| 매일 18:00 | `/api/cron/send-sms` (sms_queue) | Vercel cron (기존) |

---

## 8. 핵심 SQL 모음

### 8-1. 현재 자동화 상태 한눈

```sql
SELECT * FROM v_cs_automation_status;
```

### 8-2. 직전 24시간 dispatch 시도

```sql
SELECT batch_id, mode, candidates_count, dispatched_count, errors_count, reason, attempted_at
FROM cs_dispatch_attempts
WHERE attempted_at > now() - interval '24 hours'
ORDER BY attempted_at DESC;
```

### 8-3. 미발송 알림 현황

```sql
SELECT severity, source, count(*), max(created_at) AS last
FROM cs_dispatch_alerts WHERE status='pending'
GROUP BY 1,2 ORDER BY 3 DESC;
```

### 8-4. 자동 모드 batch 목록

```sql
SELECT id, batch_name, target_period_start, target_period_end,
       auto_dispatch_mode, survey_id, total_candidates,
       (SELECT count(*) FROM cs_survey_targets t
        WHERE t.batch_id=b.id AND t.step5_confirmed=true AND t.is_eligible=true
          AND t.distribution_id IS NULL) AS confirmed_pending
FROM cs_target_batches b
WHERE auto_dispatch_mode IN ('on','dry_run')
ORDER BY created_at DESC;
```

---

## 9. 다음 세션 진행 시 — 첫 명령

이 문서를 진실원으로 사용:

```
@apps/cs-master/docs/operations-rollout.md
Stage 0 부터 점검 시작. 외부 의존성 5개 + active cs_satisfaction
설문 1건 + 의사결정 5건 순서로 진행.
```

또는 이미 Stage 진행 중이라면:

```
@apps/cs-master/docs/operations-rollout.md
현재 Stage <N> 진행 중. <구체적 상황 한 줄>. 다음 단계 진행.
```

---

## 부록 A. 관련 코드/메모리 인덱스

- 코드 SSOT: `D:\00.26년업무\06_CS\01.설문관리\survey_sd`
  - `apps/cs-master/` (cs-master 전체)
  - `src/app/api/cron/auto-dispatch/route.ts` (PR-Auto-4)
  - `src/app/api/cron/dispatch-alerts/route.ts` (PR-Auto-5)
  - `src/app/api/distributions/cs-bridge/route.ts` (실제 발송 진실원)
  - `supabase/migrations/2026042808*` (PR-Auto-1, 3 의 SQL)

- DB SSOT: Supabase 프로젝트 `gdwhbacuzhynvegkfoga`
  - `cs_automation_settings` (싱글턴 'global')
  - `cs_target_batches.auto_dispatch_mode`
  - `cs_dispatch_attempts` / `cs_dispatch_alerts`
  - `v_cs_automation_status` 뷰

- 메모리:
  - `project_l1_automation_roadmap.md`
  - `project_factory_layer0.md`
  - `project_monorepo_migration.md`
  - `feedback_migration_discipline.md`
  - `feedback_documentation_discipline.md`
