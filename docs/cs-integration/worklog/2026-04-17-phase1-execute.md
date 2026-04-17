# 2026-04-17 · Phase 1 실행 ✅ 완료

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

## Step F — Playwright E2E (완료)
- `e2e/cs-bridge.spec.ts` 작성 — 8 테스트
  1. 401 no key · 2. 401 wrong key · 3. 400 bad payload · 4. 404 unknown batch
  5. 405 GET · 6. 200 happy path (3 dispatched) · 7. 200 재호출 (3 skipped) · 8. DB writeback 검증
- beforeAll: cs_target_batches + cs_survey_targets 3건 seed
- afterAll: 전체 cleanup (DB 완전 원복 확인)
- 실행: `npx playwright test e2e/cs-bridge.spec.ts --reporter=list` — localhost:3000 대상 4.3s 8/8 통과
- dotenv 직접 로드 (Git Bash MSYS path conversion 회피)
- 이슈 2개 해결: env path conversion (`\n` → `/n`), regex escape (`/\\n/g` literal 매칭 실패)

## Step G — Production 롤아웃 (완료)
- Production `CS_BRIDGE_API_KEY` vercel env add (preview와 분리된 새 값)
- PR #72 squash merge → main `7fccef2`
- Vercel production 자동 배포 `dpl_BGAeCiRqkdEsQ16cU7oY7NH6kCsM` READY
- Production smoke 4/4 통과: 401(no key) / 400(bad payload) / 404(fake batch) / 405(GET)
- `02. 대상자관리/참고/cs_dashboard.html` 의 `BRIDGE_KEY` 를 production 값으로 inline 주입 (`sed -i`)
- Local main 정리:
  - `ad708cc`(settings.local untrack)가 squash 안에 포함됨 → `git reset --hard origin/main`
  - `feature/cs-bridge-phase1` 브랜치 로컬·원격 삭제
  - `/tmp/cs-bridge-*-key.txt` 정리

## Step H — 문서 마무리 (완료)
- 본 worklog 헤더·Step G/H 추가
- `phase1-runbook.md` 상태 헤더 + 완료 체크리스트 tick
- `worklog/INDEX.md` 상태 표기 업데이트

---

## Production endpoint live
`https://exc-survey.vercel.app/api/distributions/cs-bridge`

cs_dashboard.html의 "설문 발송" 버튼이 이제 실제로 distributions를 생성합니다. 실 운영 발송 1회 검증은 사용자 담당 (별도 batch에 survey_id 세팅 → 대상자 선택 → 발송 → cs_survey_targets writeback 확인).

## Open Items (Phase 2 범위로 이월)
- (R1) anon 키로 `cs_survey_targets` 확장 컬럼 update 시 RLS 동작 — cs_dashboard.html에서 실 운영 시 검증 필요
- (Vercel env 근본 수정) Preview/Production `NEXT_PUBLIC_APP_URL` 값에 literal `\n` 있음. code 방어 중이지만 다른 경로 영향 위험 → Phase 2에서 dashboard에서 제거 권장
- (D1) `cs_dashboard.html` 에서 `cs_target_batches.survey_id` 지정하는 UI 없음 → 초기 운영은 SQL 수동 UPDATE. Phase 2에서 앱 UI로 이관.
