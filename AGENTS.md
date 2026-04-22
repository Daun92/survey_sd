<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# ⚠️ 라우팅 제1원칙 (작업 대상 선택 기준)

**실사용 경로**는 **Supabase edu_\* 기반** 이며, `/admin/*` 관리자 콘솔과 `/s/[token]` · `/d/[token]` 응답자 URL 만 사용한다. **Prisma 기반 `(dashboard)/*` · `/respond/[token]` · `/survey/[token]` · `/api/respond/*` 는 deprecated** 이다.

신규 개선·리팩터·버그 수정은 **반드시 실사용 경로에서만** 수행한다. Prisma 기반 경로는 상단에 노란 경고 배너와 `@deprecated` JSDoc 이 붙어 있다. 작업 전에 **해당 경로가 deprecated 인지부터 확인**할 것.

## 데이터 모델 매핑

| 실사용 (Supabase edu_\*) | Deprecated (Prisma) |
|---|---|
| `edu_surveys` / `edu_questions` / `edu_submissions` | `Survey` / `SurveyQuestion` / `Response` / `ResponseAnswer` |
| `distribution_batches` / `distributions` (Supabase UUID) | `Distribution` (Prisma int) |
| `sessions` / `courses` / `projects` / `class_groups` | — |

| 실사용 라우트 | 데이터 | 대응 deprecated |
|---|---|---|
| `/admin/surveys/[id]` 빌더 | `edu_*` | `(dashboard)/surveys/[id]` |
| `/admin/distribute` | `distribution_batches` | `(dashboard)/distribute` |
| `/admin/reports` | `edu_submissions` 집계 | `(dashboard)/reports` |
| `/s/[token]` 응답자 (full flow) | `edu_surveys.url_token` | `/survey/[token]` |
| `/d/[token]` 응답자 (개인 링크) | `distributions.unique_token` | `/respond/[token]` |
| `/api/surveys/[token]/submit` (Supabase insert) | — | `/api/respond/[token]` |

Deprecated 경로에 공용 자산·UX 개선을 얹지 않는다. 실수 방지 체크리스트: ① 대상 파일이 `(dashboard)/` · `/respond` · `/survey` · `/api/respond` · `/api/distributions` · `/api/reports` 에 있나? ② 있다면 멈추고 `/admin/*` 에서 동일 작업 가능한지 재검토.

---

# EXC-Survey 레포 내비게이션

프로덕션 URL: https://exc-survey.vercel.app · Next.js 16.2.1 (App Router, Turbopack) · React 19.2.4 · Supabase 우선, Prisma 레거시

## 주요 라우트 지도

### 관리자 / 작성자 (`/admin/*` — **실사용**, Supabase edu_\* 기반)
- **`/admin/surveys`** / **`/admin/surveys/[id]`** — 교육 설문 편집.
- **`/admin/distribute`** — 배포·발송. `distribution_batches` 단위 차수 관리.
- **`/admin/reports`** — 교육 리포트. `?survey=<id>` 로 5탭 상세 (요약 / 개별 응답 / 세그먼트 / VOC / 히트맵), `?tab=<key>` URL 동기화. 진입점 `src/app/admin/reports/page.tsx` → `ReportTabs`.
- **`/admin/responses/[surveyId]`** — 응답자별 전체 답 테이블.
- **`/admin/hrd/*`** — HRD 실태조사 도메인.

### 관리자 (`(dashboard)` group — **DEPRECATED**, Prisma)
신규 작업 금지. 각 페이지 상단에 `DeprecatedPageBanner` 가 붙어 있다. 실사용 대체는 위 `/admin/*`.
- `(dashboard)/surveys` · `(dashboard)/surveys/[id]` — 빌더 (Phase A-1 에서 3-컬럼 리팩터되었으나 실사용 안 됨, `/admin/surveys` 사용)
- `(dashboard)/distribute` · `(dashboard)/distribute/[surveyId]`
- `(dashboard)/reports` · `(dashboard)/reports/[surveyId]` · `(dashboard)/reports/annual`
- **`/admin/hrd/*`** — HRD 실태조사 도메인.

### 응답자 (공개)
- **`/s/[token]`** · **`/d/[token]`** · **`/respond/[token]`** — CS 설문 응답 (채널별 경로).
- **`/hrd/[token]`** — HRD 실태조사 응답.

## 핵심 컴포넌트 디렉터리

| 경로 | 역할 |
|---|---|
| `src/components/survey/builder/` | 빌더 V2 전부. `BuilderShell` 이 state 소유, `BuilderOutline/Canvas/Inspector` 로 분할. `QuestionPreview` 가 응답자 뷰 어댑터 |
| `src/components/survey/wizard-panel.tsx` | AI 마법사 (빌더 Sheet 로 호출) |
| `src/components/survey/LikertScale.tsx` | 리커트 공용 렌더러 (`disabled` prop 지원) |
| `src/app/admin/reports/ReportTabs.tsx` | 5탭 client 컴포넌트. SSR 집계 결과를 탭으로 분할 |
| `src/components/charts/` | 공용 차트 (score-bar, likert-distribution, section-score-table, respondent-matrix 등) |
| `src/components/forms/`, `src/components/respond/` | 응답자 UI. `.expert-theme` CSS 스코프에서만 동작 |

## 데이터 소스 구분

- **실사용 — Supabase (`edu_*`, `distribution_batches`, `distributions`, `sessions`, `courses`, `projects`, `class_groups`, `hrd_*`)**. `src/lib/supabase/*` 의 `createClient()` 로 접근. server component 에서 `await createClient()`, server action (`src/app/admin/distribute/actions.ts` 등) 에서는 `createAdminClient()` 사용.
- **Deprecated — Prisma (`Survey`/`SurveyQuestion`/`Response`/`ResponseAnswer`/`Distribution`/`Customer`)**. `src/lib/db.ts`, `src/lib/repositories/`. `(dashboard)/*` 및 일부 `/api/*` 만 참조. 신규 기능 추가 금지.

## API 라우트

### 실사용 (유지·개선 대상)
- Supabase 접근은 대부분 **server action** (`src/app/admin/**/actions.ts`) 로 처리 — 별도 REST 라우트 없음
- `/api/ai/report-comment`, `/api/ai/analyze-responses`, `/api/ai/generate-questions` — Gemini 호출. `app_settings.gemini_api_key` 필요
- `/api/cron/*` — Vercel cron (이메일·SMS 일 1회)
- `/api/distributions/cs-bridge` — 외부 CS 플랫폼 연동 (Phase 1)
- `/api/surveys/[token]/submit` — `/s/[token]` 응답 제출 (Supabase insert)

### Deprecated (Prisma, 신규 사용 금지)
- `/api/surveys/*` (빌더 전용 Prisma CRUD)
- `/api/reports/*` (stats/voc/export/annual/generate-ppt — Prisma 집계)
- `/api/distributions/*` (cs-bridge 제외 — Prisma Distribution CRUD)
- `/api/respond/[token]` (Prisma 응답 제출)

## URL 상태 동기화 규약 (Phase A cleanup)

두 client 페이지는 `useSearchParams` + `router.replace(…, { scroll: false })` 로 상태를 URL 에 반영:
- `/surveys/[id]?q=<questionId>` — BuilderShell 의 선택 문항
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
  - `survey-builder.spec.ts` — 빌더 3-컬럼 스모크 (4 tests).
  - `admin-reports-tabs.spec.ts` — 교육 리포트 5탭 스모크 (4 tests).

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
- Prisma: `npx prisma generate` (`postinstall` 자동) · `npx prisma migrate dev` (스키마 변경 시).

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
- PR 시점에 "원격 Supabase 에 마이그레이션 수동 apply 필요" 여부를 PR 본문 Test plan 에 명기할 것.
- 긴급 적용이 필요하면 Supabase SQL Editor 또는 Supabase MCP `apply_migration` 사용 가능. 단 MCP 사용 시 `schema_migrations` 에 기록이 남는 버전이 MCP 측 타임스탬프라, 추후 CLI `db push` 와 동기 유지되도록 주의.

## 주의

- **응답자 라우트·차트 기존 동작 보존**: 리팩터는 항상 `(dashboard)` 나 `/admin` 내부로 한정.
- **Prisma 스키마 변경은 별도 작업**: 마이그레이션 동반. 프론트엔드 Phase 와 분리.
- **플래그 게이팅은 한시적**: 리팩터 머지 후 1 릴리스 사이클 내 플래그·레거시 제거를 기본 원칙.
