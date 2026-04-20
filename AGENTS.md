<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# EXC-Survey 레포 내비게이션

프로덕션 URL: https://exc-survey.vercel.app · Next.js 16.2.1 (App Router, Turbopack) · React 19.2.4 · Prisma + Supabase

## 주요 라우트 지도

### 관리자 / 작성자 (`(dashboard)` group — Prisma 기반)
- **`/surveys`** — CS 설문 목록. 작성자가 새 설문 생성.
- **`/surveys/[id]`** — 3-컬럼 빌더 (아웃라인 / 캔버스 / 인스펙터). `?q=<id>` 로 선택 문항 URL 동기화. 진입점 `src/app/(dashboard)/surveys/[id]/page.tsx` → `BuilderShell`.
- **`/reports`** / **`/reports/[id]`** — CS 리포트 목록·상세 (단일 뷰, 레거시 성격).
- **`/distribute`** · **`/distribute/[surveyId]`** — 배포·발송.
- **`/customers`** · **`/training`** · **`/import`** · **`/interviews`** — 데이터 관리.

### 관리자 (`/admin` — Supabase edu_* 기반)
- **`/admin/reports`** — 교육 리포트 목록. `?survey=<id>` 로 5탭 상세 (요약 / 개별 응답 / 세그먼트 / VOC / 히트맵). `?tab=<key>` 로 탭 URL 동기화. 진입점 `src/app/admin/reports/page.tsx` → `ReportTabs`.
- **`/admin/responses/[surveyId]`** — 응답자별 전체 답 테이블.
- **`/admin/surveys`** / **`/admin/surveys/[id]`** — 교육 설문 편집(별도 에디터).
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

- **Dashboard `/surveys` · `/reports`** — Prisma (`Survey` / `SurveyQuestion` / `Response` / `ResponseAnswer` / `Distribution` / `Customer`). `src/lib/db.ts`, `src/lib/repositories/`.
- **Admin `/admin/*`** — Supabase client 직접 (`edu_surveys` / `edu_questions` / `edu_submissions` / `sessions` / `courses` / `projects`). `src/lib/supabase/server.ts`. 서버 컴포넌트에서 `await createClient()` 호출.
- **두 시스템은 독립** — 교육 CS 도메인은 Supabase, 범용 CS 설문은 Prisma.

## API 라우트

- `/api/surveys/*` — 빌더 (GET/PUT/POST/DELETE 문항).
- `/api/reports/stats`, `/voc`, `/export`, `/annual`, `/generate-ppt` — Prisma 기반 리포트 집계.
- `/api/ai/report-comment`, `/api/ai/analyze-responses`, `/api/ai/generate-questions` — Gemini 호출. `app_settings.gemini_api_key` 필요.
- `/api/distributions/*` — 배포·발송·cs-bridge.
- `/api/cron/*` — Vercel cron (이메일·SMS 일 1회).

## URL 상태 동기화 규약 (Phase A cleanup)

두 client 페이지는 `useSearchParams` + `router.replace(…, { scroll: false })` 로 상태를 URL 에 반영:
- `/surveys/[id]?q=<questionId>` — BuilderShell 의 선택 문항
- `/admin/reports?survey=<id>&tab=<key>` — ReportTabs 의 활성 탭 (`summary` 는 URL 제외, 나머지만 기록)

새로 추가되는 client 페이지도 이 패턴을 따를 것.

## E2E 테스트 (`e2e/`)

- Playwright (`playwright.config.ts`). baseURL 기본 프로덕션 URL, 로컬 대상이면 `E2E_BASE_URL` 설정.
- **인증 모델**: 공개 토큰 URL(`E2E_SURVEY_TOKEN`) 혹은 Supabase service-role(`SUPABASE_SERVICE_ROLE_KEY`). 관리자 UI 테스트는 `e2e/helpers/auth.ts` 의 `loginAsAdmin(page)` 사용. `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` 없으면 자동 `test.skip()`.
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

## 주의

- **응답자 라우트·차트 기존 동작 보존**: 리팩터는 항상 `(dashboard)` 나 `/admin` 내부로 한정.
- **Prisma 스키마 변경은 별도 작업**: 마이그레이션 동반. 프론트엔드 Phase 와 분리.
- **플래그 게이팅은 한시적**: 리팩터 머지 후 1 릴리스 사이클 내 플래그·레거시 제거를 기본 원칙.
