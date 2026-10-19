# 로컬 ↔ Git / Vercel / Supabase 상태 진단 (2026-06-09)

> 목적: 개발 재개 전 로컬 작업 상태가 원격 3축과 어디까지 일치하는지 확정하고, 정리가 필요한 지점을 박제.

## 결론 한 줄

**Git·환경은 즉시 개발 가능 상태. 유일한 실질 리스크는 Supabase 마이그레이션 이력 드리프트** — 원격에 적용됐지만 로컬 `supabase/migrations/`·git 에 없는 마이그레이션이 **53개**. 새 마이그레이션 작성·`db push`·`db reset` 전에 정리 필요.

---

## 1) Git — ✅ 동기 완료

- `main` = `origin/main` (0 ahead / 0 behind), 워킹트리 clean, 미푸시 커밋 없음.
- 최신 커밋 `29a001e` (cs-master T-056, `apps/cs-master/*.py` 데이터 파이프라인).
- 머지된 PR 브랜치(`feat/survey-internal-label`, `fix/survey-subtitle-dedup`, `perf/admin-prefetch-and-cache`)는 fetch 시 원격에서 prune 됨.

### 정리 대상 (개발 재개와 무관)
- worktree `flamboyant-neumann` → `chore/prisma-full-schema-sync` : `prisma/schema.prisma` 수정본 보유. **Prisma 는 Sprint B(2026-04-26)에서 완전 제거** → 폐기 대상.
- worktree `romantic-lederberg` : 의미 있는 변경 없음(`.claude/` 파일만).
- `stash@{0}` : `lab/bris-explorer` 의 pre-Sprint-B 작업. 방치 중 — 필요 없으면 drop.

## 2) Vercel — ⚠️ MCP 재인증 필요 (직접 검증 불가)

- `list_deployments` → 403 (`daun92s-projects` 스코프 재인증 요구).
- 간접 추론: `main` push → 프로덕션 자동 배포 규약상 프로덕션 = `29a001e`.
  최근 3커밋은 `apps/cs-master/*.py`(오프라인 파이프라인)이라 Next.js 빌드 산출물에는 영향 없음 → 앱 배포는 실질적으로 `c63ff63`(#148) 시점과 동일.

## 3) Supabase — ❗ 마이그레이션 이력 드리프트 (핵심)

원격 `supabase_migrations.schema_migrations` 총 **113개** 기록. 로컬 파일은 62개.

| 구분 | 개수 | 처리 |
|---|---|---|
| 원격에만 있고 로컬 파일 없음 | **53** | 아래 표 — 정리 필요 |
| 로컬에만 있고 원격 미표시 | 2 | **드리프트로 확정** (아래) — 이미 적용됨 |

### 3-1. 로컬 pending 2개 = 이미 적용됨 (버전 타임스탬프 드리프트)

MCP/SQL Editor 로 적용되면서 원격 버전 번호가 로컬 파일명과 달라진 케이스. 이름 대조로 동일 변경 확인:

| 로컬 파일 | 원격 적용 버전 | 변경 내용 |
|---|---|---|
| `20260519024423_fix_survey_options_and_eco_branch` | `20260519035304` (≈50분 후) | edu_questions/cs_survey_questions options 정규화 |
| `20260519051117_edu_surveys_internal_label` | `20260519051141` (≈24초 후) | `edu_surveys.internal_label` 컬럼 추가 |

→ 둘 다 idempotent(`ADD COLUMN IF NOT EXISTS`, `UPDATE`)이고 프로덕션에서 사용 중. **재적용해도 무해, 다만 이력상 중복.**

### 3-2. 원격에만 있는 53개 (로컬·git 미보존) — 도메인별

거의 전부 **CS-master / BRIS 도메인(R1–R10 라운드 + T-044~T-056)** 작업. MCP·SQL Editor 로 원격에 직접 적용된 뒤 로컬 마이그레이션 파일로 회수되지 않음.

**bris_archive (1)**
- `20260422100000` bris_archive_permissions — schema comment

**CS-master 코어 — 함수/뷰/컬럼 (2026-04-30 ~ 05-19)**
- `20260430013358` fn_cs_step2_recheck_for_projects
- `20260430015244` fn_cs_step2_v2_project_level (fn_cs_step2_check_last_course)
- `20260430023414` cs_integrity_check_views (v_cs_integrity_details/summary, cs_sync_logs 컬럼)
- `20260430073246` r2_pre_selected_columns_and_rpcs (cs_projects.pre_selected*, fn_cs_project_toggle_pre_selected, fn_cs_target_set_exclusion, fn_cs_batch_confirm)
- `20260430074435` r2_add_project_uuid_to_target_detail_v2 (v_cs_target_detail)
- `20260430085455` r2_step3_recognize_pre_selected (fn_cs_step3_check_project_closed)
- `20260505232446` cleanup_dup_batches_and_fix_auto_batch_policies_v2 (cs_target_batches 제약, fn_cs_cron_monthly_batch, fn_cs_post_sync_auto_batch)
- `20260508014344` cs_bris_freshness_check (fn_cs_check_bris_freshness, cs_dispatch_alerts)
- `20260508014430` cs_bris_freshness_check_severity_fix
- `20260508015202` v_cs_target_detail_add_bris_project_id
- `20260508015843` v_cs_target_profile_create
- `20260508024015` v_cs_target_profile_add_course_schedule
- `20260508043033` v_cs_target_profile_echo_reason_fallback
- `20260508080135` a1_a3_business_type_b2c_round_batch (fn_cs_business_type, fn_cs_create_round_batch)
- `20260508082846` alpha_beta_within_batch_dup_and_backfill (fn_cs_distributions_backfill_target)
- `20260508082940` beta_backfill_dedup_per_target
- `20260508083316` gamma_external_history_import_rpc (fn_cs_external_history_import, cs_external_send_history)
- `20260519041826` r3_batch_lifecycle_rpcs (fn_cs_batch_archive, fn_cs_batch_preview)
- `20260519044451` r4_contact_extract_positions
- `20260519044530` r4_contact_extract_positions_fix
- `20260519051532` r4_contact_set_position
- `20260519053219` r5_data_completeness_view (v_cs_data_completeness)
- `20260519055712` r5_project_set_closure (fn_cs_project_set_closure)
- `20260519072017` r6_send_with_response_view (fn_cs_norm_company, v_cs_send_with_response, v_cs_response_rate_by_month)
- `20260519072111` r6_send_with_response_view_fix
- `20260519081022` r6_send_unified_view_v2 (v_cs_send_unified 신설, 기존 뷰 DROP→재생성)
- `20260519082357` r6_send_unified_phone_norm (fn_cs_step4_check_survey_history)
- `20260519082422` r6_send_with_response_unified
- `20260519090214` r7_sync_logs_fix (cs_sync_logs, fn_cs_post_sync_auto_batch)
- `20260519091619` r7_selection_history_table (**cs_selection_history 신규 테이블**)

**HRD 시드 데이터 (2026-05-13, 8개)**
- `20260513050800`~`051355` reseed_hrd_round_22 step1~4 (rounds/parts/items)
- `20260513081358`~`082019` seed_21th step1~4 (rounds/parts/items)

**CS-master R8–R10 (2026-05-27, 9개)**
- `20260527045855` r8_target_detail_add_bris_ids
- `20260527050333` r8b_target_detail_add_business_id
- `20260527052228`/`052258`/`052328`/`062712` r8c_respondents_backfill_rpc v1~v4 (fn_cs_respondents_backfill_cs_contact_id)
- `20260527052442` r8d_post_sync_hook_respondent_backfill
- `20260527053055` r8e_target_detail_add_echo_id
- `20260527090607` r10_step5_distinct_recount (fn_cs_step5_confirm_targets, fn_cs_batch_recount_eligible)

**CS-master T-052/055/056 (2026-05-28, 3개)** — 최근 git 커밋(`apps/cs-master`)과 짝
- `20260528010139` t052_cs_projects_echo_page_absent (cs_projects.echo_page_absent)
- `20260528024018` t055_cs_projects_im_name_no (cs_projects.im_name/im_no)
- `20260528034939` t056_cs_staff_and_project_staff (**cs_staff, cs_project_staff 신규 테이블**)

> 주: 53개 모두 `schema_migrations.statements` 1개짜리 — MCP `apply_migration` 단발 적용 흔적. 원본 SQL 은 원격 `schema_migrations.statements` 컬럼에 보존돼 있어 회수 가능.

## 4) 개발 준비 상태 — ✅

- `.env.local` (36 vars), `node_modules` 설치 완료 → `npm run dev` 즉시 가능.

---

## 권장 정리 경로 (택1, 새 Supabase 작업 전 선행)

1. **`supabase db pull`** — 원격 현재 스키마를 단일 마이그레이션으로 내려받아 git 보존. 53개 변경분이 코드로 들어오지만 이력 파일이 크게 재구성됨. 가장 정확하나 리뷰 부담.
2. **`migration repair --status applied 20260519024423 20260519051117`** — 로컬 pending 2개를 적용됨 처리해 `db push` 안전성만 빠르게 확보. 단 53개는 여전히 로컬에 SQL 부재(스키마 재구성 불가).
3. **원격 `schema_migrations.statements` → 로컬 파일 역추출** — 53개 SQL 을 원격에서 꺼내 타임스탬프 그대로 `supabase/migrations/` 에 박제 후 `migration repair --status applied` 로 적용표시. 이력·파일 완전 일치. 가장 손이 가지만 향후 `db reset`/온보딩까지 정상화.

> AGENTS.md 의 마이그레이션 컨벤션·DROP SCHEMA 체크리스트와 직접 연결되는 이슈. 정리 PR 시 그 규약 준수.
