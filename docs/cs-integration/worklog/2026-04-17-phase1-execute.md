# 2026-04-17 · Phase 1 실행 (Step A · B 완료 · C 착수)

**Goal**: runbook Step A~C 실제 실행. 설계는 모두 완료(이전 세션 파일), 이제 착수.

## Done

### Step A — 브랜치·환경 준비
- 브랜치 `feature/cs-bridge-phase1` 생성 (main 기반)
- Vercel 프로젝트 링크 (`.vercel/` 생성, 프로젝트: `daun92s-projects/exc-survey`)
- `vercel env pull` 로 `.env.local` 구성 (preview + CRON_SECRET + APP_URL)
- `CS_BRIDGE_API_KEY` 로컬용 64-hex 생성 + append
- `npx prisma generate` 실행 (src/generated/prisma 재생성)
- TypeScript 컴파일 src/ 에러 0 확인
- `.env*.local` 자동 gitignore 추가됨 (vercel CLI가 반영)

### Step B — DB 마이그레이션 (028)

**1차 시도 에러**:
```
foreign key constraint "cs_target_batches_survey_id_fkey" cannot be implemented
DETAIL: Key columns "survey_id" and "id" are of incompatible types: uuid and integer.
```

**원인 조사 결과 (→ ADR-008)**:
- `public.surveys` (id integer, 0 rows) = Prisma legacy 모델, 실사용 안 됨
- `public.edu_surveys` (id uuid, 9 rows) = 실운영 설문 테이블
- `public.distributions` (uuid) · `public.distribution_batches` (uuid) 의 `survey_id` FK 는 `edu_surveys` 참조
- `src/app/admin/distribute/actions.ts` 등 20+ 파일이 Supabase client (`from('edu_surveys')`) 사용
- Prisma `Distribution` 모델(int ID)의 `distribution.repository.ts` 는 legacy 코드

**수정 후 재적용**:
- FK 타겟을 `edu_surveys(id)` 로 변경 → 성공
- 적용된 스키마 변경:
  - `cs_survey_targets` : +6 컬럼 (distribution_id, survey_token, survey_url, dispatched_at, dispatch_channel, dispatch_error) + 2 인덱스
  - `distribution_batches` : +2 컬럼 (source, source_batch_id) + 1 인덱스
  - `cs_target_batches` : +1 컬럼 (survey_id, FK → edu_surveys)
- 기존 레코드 영향 확인:
  - distribution_batches 5건 모두 `source='manual'` (default 적용)
  - cs_target_batches 5건 survey_id NULL (예상대로)
  - cs_survey_targets 80건 distribution_id NULL (예상대로)

### 문서 갱신
- `decisions.md` +ADR-008 (edu_surveys 발견 · Supabase client 단일화)
- `phase1-spec.md`, `phase1-runbook.md` : `surveys` → `edu_surveys` 교체
- `phase1-runbook.md` C-2 : Prisma 의존성 제거, Supabase client 단일화로 스켈레톤 수정

### 커밋
- `9a0b578 feat(cs-integration): Phase 1 Step B — docs + migration 028`
  - docs/cs-integration/ 전체 신규 (README·context·decisions·phase1/2·worklog)
  - supabase/migrations/028_cs_bridge_phase1.sql
  - .gitignore (.env*.local)

## Decisions (append 결정)
- **ADR-008**: 실운영 설문 = `edu_surveys`. Bridge API도 Supabase client 단일화 (Prisma 사용 제거, ADR-007 강화)

## Step C — Bridge API 구현 (완료)
- `src/app/api/distributions/cs-bridge/route.ts` 401줄, Supabase service_role 단일
- 수동 payload 검증 (zod 의존 미추가), UUID regex, 500건 cap
- cs_target_batches → survey_id, cs_survey_targets 재검증 (is_eligible + step5_confirmed + distribution_id null)
- distribution_batches upsert (`source='cs-bridge'`, `source_batch_id=batchId`)
- distributions insert (unique_token DB default, channel auto→email→sms 폴백)
- cs_survey_targets writeback 6 필드
- `npm run build` 통과, dev smoke 5/5 통과 (401/400/404/405)
- 커밋 `11b72f9`

## Step E — Preview 배포 + E2E (완료)
- 브랜치 push `feature/cs-bridge-phase1`
- Vercel Preview env `CS_BRIDGE_API_KEY` (scope = feature 브랜치)
- PR #72 생성
- 첫 빌드는 env 주입 안 됨 (env 추가 전 트리거된 빌드). 빈 커밋 `9c3d674` 로 재배포
- **1차 E2E 이슈**: `surveyUrl` 에 `\n` 포함 — Preview env `NEXT_PUBLIC_APP_URL` 값이 `"https://exc-survey.vercel.app\n"` (literal `\n` 2자) 로 저장돼 있음
- 방어 fix 2번 (trim → replace 강화): `d8a5c23`, `f3a5c98`
- **최종 E2E**: dispatched=1 / skipped=1 (already_dispatched, 중복방지 정상) / errors=0, `surveyUrl` 깨끗
- DB 검증: distributions writeback / cs_survey_targets writeback / distribution_batches source='cs-bridge' 모두 정확
- 테스트 데이터 cleanup 완료 (DB는 테스트 전 상태)

## Decisions (append)
- **ADR-008** (기존): edu_surveys 기준
- fix 방어 패턴: env 값에 literal `\n` 섞일 수 있음 → `.replace(/\\n/g,"")` + `.replace(/[\r\n\s]+/g,"")` 필수

## Next
- **Step F** (선택): Playwright E2E 자동화 — preview 환경 활용
- **Step G**: Production 롤아웃
  - main 머지 (PR #72)
  - Production env `CS_BRIDGE_API_KEY` 세팅 (preview 와 분리된 값 권장)
  - `NEXT_PUBLIC_APP_URL` production 값 확인 (newline 없는지)
  - cs_dashboard.html `BRIDGE_KEY` placeholder 교체 + 실 발송 E2E
- **Step H**: 문서 마무리 + runbook 완료 체크

## Open Items
- (Vercel env 근본 수정) Preview/Production `NEXT_PUBLIC_APP_URL` 값에 `\n` 있는지 dashboard에서 확인·제거. code가 방어하지만 다른 코드 경로가 영향 받을 수 있음
- D1 (cs_dashboard.html survey_id 지정 UI) 미결. 운영 전까지 SQL 수동 UPDATE로 대체
