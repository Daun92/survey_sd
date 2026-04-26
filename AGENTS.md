<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 배포·환경 좌표

- **Vercel 프로젝트**: `exc-survey` (team `daun92's projects`, id `prj_PgjIppaIsTazIkQxrA63EIlbfBjm`)
- **배포 URL**: https://exc-survey.vercel.app — `main` push → Vercel 프로덕션 자동 배포
- **Supabase 프로젝트**: `cs-survey` (ref `gdwhbacuzhynvegkfoga`, region `ap-northeast-2`)
- **GitHub**: https://github.com/Daun92/survey_sd
- **Cron**: Vercel cron `/api/cron/send-emails`, `/api/cron/send-sms` (일 1회)

---

# ⚠️ 라우팅 제1원칙

**실사용 경로**: `/admin/*` 관리자 콘솔(Supabase `edu_*` · `hrd_*` 기반), `/s/[token]` · `/d/[token]` 응답자 URL.

**Prisma 인프라는 2026-04-26 Sprint B 에서 완전 제거**. 잔존 데이터(706 customers + 5 service_types) 는 `docs/archives/legacy-prisma-2026-04-26/` 의 README 기준 외부 저장소에 박제됨. 향후 BRIS API 본격 연동 시점에 새 형태로 재구성.

## 데이터 모델

| Supabase | 용도 |
|---|---|
| `edu_surveys` / `edu_questions` / `edu_submissions` | 교육 설문 — 빌더/응답/리포트 |
| `distribution_batches` / `distributions` (UUID) | 배포 차수 + 개별 발송 |
| `sessions` / `courses` / `projects` / `class_groups` | 교육 행정 트리 |
| `hrd_*` | HRD 실태조사 도메인 |

---

# EXC-Survey 레포 내비게이션

프로덕션 URL: https://exc-survey.vercel.app · Next.js 16.2.1 (App Router, Turbopack) · React 19.2.4 · Supabase 단일 데이터 소스

## 주요 라우트 지도

### 관리자 / 작성자 (`/admin/*` — **실사용**, Supabase edu_\* 기반)
- **`/admin/surveys`** / **`/admin/surveys/[id]`** — 교육 설문 편집.
- **`/admin/distribute`** — 배포·발송. `distribution_batches` 단위 차수 관리.
- **`/admin/reports`** — 교육 리포트. `?survey=<id>` 로 5탭 상세 (요약 / 개별 응답 / 세그먼트 / VOC / 히트맵), `?tab=<key>` URL 동기화. 진입점 `src/app/admin/reports/page.tsx` → `ReportTabs`.
- **`/admin/responses/[surveyId]`** — 응답자별 전체 답 테이블.
- **`/admin/hrd/*`** — HRD 실태조사 도메인.

### Prisma 레거시 — **완전 제거 (2026-04-26 Sprint B)**
- 2026-04-22 PR 2: 설문/배포/리포트 Prisma 페이지·API 제거
- 2026-04-24 PR A4: `(dashboard)` 라우트 그룹 전체 + 레거시 layout 제거
- **2026-04-26 Sprint B**: Prisma API 6개 + `src/lib/db.ts` + `src/lib/repositories/` + `prisma/` 디렉터리 + `src/generated/prisma/` + npm 의존성 (`prisma`/`@prisma/client`/`@prisma/adapter-pg`) 통째 폐기
- 데이터(706 customers + 5 service_types)는 `docs/archives/legacy-prisma-2026-04-26/` 의 README 기준 외부 저장소 박제. BRIS API 연동 시점에 신 스키마로 재구성 예정

### 응답자 (공개)
- **`/s/[token]`** · **`/d/[token]`** — CS 설문 응답 (공통 URL / 개인 링크).
- **`/hrd/[token]`** — HRD 실태조사 응답.
- _(deprecated `/respond/[token]`, `/survey/[token]` 은 2026-04-22 삭제됨)_

## 핵심 컴포넌트 디렉터리

| 경로 | 역할 |
|---|---|
| `src/app/admin/surveys/[id]/SurveyEditor.tsx` | 실사용 설문 편집기. Supabase edu_surveys/edu_questions 를 server action (`./actions.ts`) 으로 조작 |
| `src/app/admin/surveys/[id]/ai-fab.tsx` | AI 마법사 · 템플릿 적용. `addQuestion`, `bulkAddQuestions` server action 호출 |
| `src/components/survey/LikertScale.tsx` | 리커트 공용 렌더러 (`disabled` prop 지원) |
| `src/app/admin/reports/ReportTabs.tsx` | 5탭 client 컴포넌트. SSR 집계 결과를 탭으로 분할 |
| `src/components/charts/` | 공용 차트 (score-bar, likert-distribution, section-score-table, respondent-matrix 등) |
| `src/components/forms/`, `src/components/respond/` | 응답자 UI. `.expert-theme` CSS 스코프에서만 동작 |

## 데이터 소스

**Supabase 단일 소스** (`edu_*`, `distribution_batches`, `distributions`, `sessions`, `courses`, `projects`, `class_groups`, `hrd_*`). `src/lib/supabase/*` 의 `createClient()` 로 접근. server component 에서 `await createClient()`, server action 등에서는 `createAdminClient()` (service role) 사용.

> Prisma 는 2026-04-26 Sprint B 에서 완전 제거됨. `prisma/`, `src/lib/db.ts`, `src/lib/repositories/`, `@prisma/*` 의존성 모두 사라졌다.

## API 라우트

- Supabase 접근은 대부분 **server action** (`src/app/admin/**/actions.ts`) 로 처리 — 별도 REST 라우트 없음
- `/api/ai/report-comment`, `/api/ai/analyze-responses`, `/api/ai/generate-questions` — Gemini 호출. `app_settings.gemini_api_key` 필요
- `/api/cron/*` — Vercel cron (이메일·SMS 일 1회)
- `/api/distributions/cs-bridge` — 외부 CS 플랫폼 연동 (Phase 1)
- `/api/distributions/[id]/status` — `/s/[token]` 진입 시 상태 업데이트
- `/api/surveys/[token]/submit` — `/s/[token]` 응답 제출 (Supabase insert)
- `/api/surveys/[id]/export` — `/admin/reports` CSV export (Supabase 집계)
- `/api/hrd/responses/save`, `/api/settings`, `/api/upload` — `/admin/*` 에서 사용

### 제거됨
- **2026-04-22 PR 2**: `/api/surveys/{route,[id]/route,[id]/questions,templates}` (Prisma 빌더), `/api/reports/*` (stats/voc/export/annual/generate-ppt), `/api/distributions/{route,[id]/route,send,remind,send-sms}` (cs-bridge·status 제외), `/api/respond/[token]`, `/api/dashboard`
- **2026-04-26 Sprint B**: `/api/customers/*`, `/api/training/*`, `/api/interviews/*`, `/api/responses/manual`, `/api/service-types`, `/api/workflow/status` — Prisma 인프라 통째 폐기와 함께

## URL 상태 동기화 규약 (Phase A cleanup)

client 페이지는 `useSearchParams` + `router.replace(…, { scroll: false })` 로 상태를 URL 에 반영:
- `/admin/reports?survey=<id>&tab=<key>` — ReportTabs 의 활성 탭 (`summary` 는 URL 제외, 나머지만 기록)

새로 추가되는 client 페이지도 이 패턴을 따를 것.

## E2E 테스트 (`e2e/`)

- Playwright (`playwright.config.ts`). baseURL 기본 프로덕션 URL, 로컬 대상이면 `E2E_BASE_URL` 설정.
- **인증 모델**: 공개 토큰 URL(`E2E_SURVEY_TOKEN`) 혹은 Supabase service-role(`SUPABASE_SERVICE_ROLE_KEY`). 관리자 UI 테스트는 `e2e/helpers/auth.ts` 의 `loginAsAdmin(page)` 사용. `SURVEY_CS_ID` / `SURVEY_CS_PW` (운영 CS 관리 계정) 없으면 자동 `test.skip()`. legacy `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` 도 fallback 으로 허용.
- **데이터**: 필요 시 `beforeAll` 에서 service-role 로 seed, `afterAll` 에서 cleanup (예: `cs-bridge.spec.ts`).
- **실행**: `npx playwright test e2e/<spec>.spec.ts --reporter=list`
- **현 스펙**:
  - `cs-bridge.spec.ts` — `/api/distributions/cs-bridge` 회귀.
  - `survey-response.spec.ts` — 응답자 flow.
  - `admin-reports-tabs.spec.ts` — 교육 리포트 5탭 스모크 (4 tests).
  - _(구 `survey-builder.spec.ts` 는 2026-04-22 BuilderShell 제거와 함께 삭제됨 — 후속 PR 에서 `/admin/surveys/[id]` SurveyEditor 기반 신규 스펙 작성 예정)_

## 커밋·PR 컨벤션

- 브랜치: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- 커밋 메시지 앞머리: `feat(scope):` `fix(scope):` `chore(scope):` `test(scope):` `docs(scope):`. scope 예시: `builder`, `admin-reports`, `cs-integration`.
- 다단계 Phase 작업은 Phase 표기 포함 (예: `feat(builder): 3-컬럼 리팩터 (Phase A-1)`).
- PR 본문: Summary + Test plan 체크리스트.

## 빌드·개발

- `npm run dev` — Turbopack dev. Windows 한글 경로 환경에서 PostCSS 워커가 간헐 크래시(`0xc0000142`). 재현 시 `.next` 삭제 후 재기동.
- `npm run build` — 프로덕션 빌드. 현재 ~10s / 59 pages.
- `npx tsc --noEmit` — 타입체크.
- `npx eslint <path>` — 린트.
- `npx vitest run` — 단위 테스트.

## 로컬 개발 환경 세팅 (신규 clone / worktree)

```bash
# 1) Vercel 프로젝트 링크
vercel link --yes --project exc-survey

# 2) 환경변수 내려받기 (preview 기준 + CRON_SECRET 수동 보강)
vercel env pull .env.local --environment=preview --yes
vercel env pull .env.development.tmp --environment=development --yes
grep "^CRON_SECRET=" .env.development.tmp >> .env.local
echo 'NEXT_PUBLIC_APP_URL="http://localhost:3000"' >> .env.local
rm .env.development.tmp

# 3) 의존성
npm install

# 4) dev 서버
npm run dev   # http://localhost:3000
```

**주의**: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_APP_URL` 는 Vercel **Development 환경에는 없고** Preview/Production 에만 있어서 `--environment=preview` 로 pull 한다. `CRON_SECRET` 은 반대로 Development 에만 있으니 별도로 합친다.

## Supabase 마이그레이션 컨벤션

**신규 마이그레이션은 반드시 타임스탬프 형식으로 생성한다.**

기존 파일은 `001_..` ~ `031_..` 연번을 쓰지만, Supabase CLI 의 `db push` 는 `schema_migrations` 에 **14자리 타임스탬프 버전**으로 기록한다. 신규 연번(`032_..`)을 만들면 CLI 가 그것을 "이미 적용됨"으로 오인해 **스킵**하는 버그가 발생했다 (2026-04-20, 031 적용 실패 → MCP 수동 복구).

- 신규 파일 생성:
  ```bash
  npx supabase migration new <snake_case_name>
  # → supabase/migrations/YYYYMMDDHHMMSS_<name>.sql 자동 생성
  ```
- 적용:
  ```bash
  npx supabase db push
  # 원격 schema_migrations 와 비교해 없는 파일만 순차 apply
  ```
- 기존 `001_..~031_..` 는 건드리지 않는다 (이미 프로덕션 반영됨).
- **신규 파일은 반드시 14-digit 타임스탬프 (`YYYYMMDDHHMMSS_<snake_case>.sql`)** — 연번 (`NNN_`) 절대 금지.
- **같은 타임스탬프·같은 prefix 중복 금지** — 과거 `002_..`·`015_..` 중복으로 CLI 추적이 꼬여 한 차례 정상화 작업(2026-04-24) 이 필요했다.
- PR 시점에 "원격 Supabase 에 마이그레이션 수동 apply 필요" 여부를 PR 본문 Test plan 에 명기할 것.
- 긴급 적용이 필요하면 Supabase SQL Editor 또는 Supabase MCP `apply_migration` 사용 가능. 단 MCP 사용 시 `schema_migrations` 에 기록이 남는 버전이 MCP 측 타임스탬프라, 추후 CLI `db push` 와 동기 유지되도록 주의 — 가능하면 **항상 CLI `db push` 를 정식 경로로 쓰고**, MCP 는 로컬 환경에서 CLI 가 안 되는 상황의 마지막 수단으로만.

### Idempotent 체크리스트 (모든 신규 SQL 파일 필수)

신규 마이그레이션은 rollback 안전성과 재실행 안전성을 위해 다음 패턴을 따른다:

- **CREATE**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE OR REPLACE VIEW`
- **ALTER**: 컬럼 추가는 `ADD COLUMN IF NOT EXISTS`, 제약 추가는 `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` 패턴
- **DROP**: 반드시 `IF EXISTS`. 데이터가 있는 테이블 DROP 은 PR Test plan 에 영향 범위 · 복구 계획 명시
- **INSERT (seed)**: `ON CONFLICT DO NOTHING` 또는 `ON CONFLICT ... DO UPDATE` — 재실행으로 중복 행 생성 방지
- **GRANT/REVOKE**: 권한은 멱등하지만 명시적 `REVOKE ... FROM anon, authenticated` 후 필요 권한만 `GRANT` 로 화이트리스트화

PR 리뷰 시 이 체크리스트 위반이 있으면 머지 보류.

### DROP SCHEMA 체크리스트 (2026-04-22 사고 재발 방지)

**쉬운 풀이.** 우리 앱이 DB 와 대화하는 방식은 두 경로다. ① 우리가 직접 쓰는 SQL (MCP / SQL Editor) — 테이블이 있으면 바로 읽는다. ② Next.js 서버가 `supabase.from(...)` 으로 호출하는 Supabase REST API — 내부적으로 **PostgREST** 라는 서비스가 "어떤 스키마·테이블·컬럼이 있고 어떻게 연결되는지"를 미리 **카탈로그(=schema cache)** 로 만들어 놓고 거기에 맞춰 쿼리를 번역한다.

이 카탈로그는 "내가 볼 스키마 목록" 이라는 설정(`pgrst.db_schemas`)을 기준으로 만들어지는데, 이 설정은 `authenticator` 라는 DB role 에 **DB 에 영구 저장**되어 있다. 과거 어느 시점에 BRIS 도메인도 REST 로 노출하려고 `public, graphql_public, bris` 로 잡아뒀었다. 오늘 새벽 `DROP SCHEMA bris` 를 실행하면서 이 설정만 같이 지우지 않은 게 문제. PostgREST 입장에선 "bris 도 훑어야 하는데 그런 스키마가 없다" 는 에러가 카탈로그 작성 단계에서 계속 터지고, 카탈로그가 못 만들어지니 **모든 REST 호출이 503/PGRST002** 로 막힌다. 테이블과 데이터는 멀쩡하지만 "창구 직원이 안내 책자를 못 만들어서 손님을 아무도 못 받는" 상태였던 것.

즉 이 유형의 사고는 **DB 에 조용히 남아 있는 옛날 설정이 새 스키마 상태와 어긋날 때** 터진다. 그래서 "스키마를 지우면 그 스키마를 참조하는 설정·메타데이터도 같은 트랜잭션에서 함께 정리한다" 가 규칙이다.

`DROP SCHEMA` 를 포함하는 마이그레이션을 작성할 때는 같은 파일 안에서 아래를 함께 정리할 것:

1. **PostgREST 노출 목록에서 제거** — `ALTER ROLE authenticator SET pgrst.db_schemas = '<기존 목록에서 해당 스키마 제거>';` (현재 값은 `SELECT rolconfig FROM pg_roles WHERE rolname='authenticator';` 로 확인)
2. **역할별 `search_path` 점검** — `postgres`, `authenticator`, `supabase_admin` 등에서 드랍 대상 스키마가 들어 있으면 제거.
3. **해당 스키마를 참조하는 public 함수/뷰** — `pg_get_functiondef` / `pg_views.definition` 에 `<schema>.` 문자열이 남아 있지 않은지 grep.
4. **PostgREST reload 트리거** — 마이그레이션 말미에 `NOTIFY pgrst, 'reload config'; NOTIFY pgrst, 'reload schema';` 추가.
5. **복구 절차 기록** — 만약 적용 후에도 REST 가 503 이면 Supabase SQL Editor 나 MCP `execute_sql` 로 (1)+(4) 를 수동 실행. Postgres 로그 (`get_logs service=postgres`) 에서 `schema "X" does not exist` 가 찍히면 이 가설이 맞다.

## 주의

- **응답자 라우트·차트 기존 동작 보존**: 리팩터는 항상 `/admin` 내부로 한정.
- **플래그 게이팅은 한시적**: 리팩터 머지 후 1 릴리스 사이클 내 플래그·레거시 제거를 기본 원칙.
