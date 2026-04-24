# 기술 부채 정리 + 개발 로드맵 (2026-04-24)

## 배경

`exc-survey` 는 빠른 반복 개발로 기능 두께를 확보했으나, 최근 `/admin/*` Supabase 이관(2026-04-22 PR 2) 과 성능 개선(PR #113) 후에도 여러 범주에서 기술 부채가 남았다. 본 문서는 3개 Explore 에이전트가 동시 스캔한 **2026-04-24 기준 main HEAD `cc4c4f1`** 의 부채 인벤토리와 순서 있는 실행 로드맵이다.

진행 기준: ROI × (거꾸로) 복잡도, 의존관계 단방향성, 배포 안전성.

---

## Part 1 · 부채 인벤토리

### A. Prisma 레거시 (가장 큰 단일 부채)

- **코드 자산**: `src/lib/db.ts`, `src/lib/repositories/*` 4개, `src/generated/prisma/` 43 파일 ≈ 137 KB, `prisma/schema.prisma` 14 모델
- **빌드**: `package.json` 의 `"build": "prisma generate && next build"` 강제 postinstall
- **경로 분포**:
  - **Deprecated 완료, 즉시 제거 가능** (7 페이지 / 관련 API):
    - `src/app/(dashboard)/surveys/**` (2)
    - `src/app/(dashboard)/distribute/**` (2)
    - `src/app/(dashboard)/reports/**` (3)
    - `src/app/respond/[token]/*`, `src/app/survey/[token]/*` (DeprecatedBanner + `@deprecated` JSDoc)
    - `/api/respond/[token]` (deprecated)
  - **이관 필요 (아직 Prisma 전용, `/admin` 미이관)**:
    - `(dashboard)/customers`, `/api/customers/*` → `Customer` 모델 (Supabase 미정의)
    - `(dashboard)/training` + `target-list` + `/api/training/*` → `TrainingRecord`
    - `(dashboard)/interviews` + `/api/interviews/*` → `Interview`
    - `(dashboard)/import` — 구현 stub, customers/training 이관 후 삭제
- **내부 Link 검증**: `/admin/*` 에서 deprecated `(dashboard)/*` 로 이동하는 Link **0건** — 제거 시 UX 충격 없음 (DeprecatedBanner 안내만 사라짐)

### B. Lab / BRIS 실험 영역

- 5개 하위 경로 (`/admin/lab/bris/{index,quality-timeline,sync-status,archive}`) 존재
- 의존 테이블: `mlops_*` 6종 (정상화 완료 2026-04-23), `cs_sync_logs`, `cs_survey_targets`, `bris_api_keys` (legacy 보존)
- 과거 `bris_archive.*` 는 PITR 복구 철회로 영구 소실 (bris-lab-findings.md 박제)
- **승격 후보**: `/admin/lab/bris/quality-timeline` — 운영자 일일 대시보드 수준의 신호 밀도
- **미완**: classifier version history UI, mlops pipeline 조인 뷰, dnExcel→edge function 수집 파이프라인
- 문서 5종 (`docs/dev/bris-*.md`) 잘 유지됨 (roadmap·runbook·findings·sources·collection-roadmap)

### C. Migrations 위생

- 현재 39 파일: `001~031` 연번 + 8 개 14-digit 타임스탬프
- 2026-04-24 에 80개 ghost entry + 중복 prefix 3개 rename 정상화 완료
- **남은 위험**:
  1. 연번+타임스탬프 혼재로 미래 혼선 재발 가능
  2. `supabase/migrations/20260423014714_mlops_rls_normalize.sql` & `20260423024749_bris_api_keys_preserve_and_lock.sql` — 원격에 이미 반영됐는데 **git 에는 untracked** (lab/bris-explorer 브랜치에 로컬 상주)
  3. 일부 `DROP/ALTER` 무조건 실행 (idempotent 취약)
  4. `20260422100000_bris_archive_permissions.sql` 은 실질 no-op (bris_archive 미존재)

### D. 관측성 — 0 수준

- `@vercel/analytics` · `@vercel/speed-insights` **미설정**
- Sentry / Logflare / OpenTelemetry **0**
- 에러 경계: `/app/error.tsx`, `/app/admin/error.tsx`, `/app/admin/lab/error.tsx` **3개만**. HRD·distribute·reports 섹션 커버 없음
- Cron 실패 알림 **없음** (`/api/cron/*` 는 200 반환뿐)
- `console.log/warn/error` 44회 — 대부분 의미 있는 에러지만 구조화 없음

### E. 테스트 커버리지 — E2E 얕음, Unit 0

- Playwright 스펙 4개(610줄) 만 존재
  - `survey-builder.spec.ts` (AGENTS.md 는 "삭제됨" 기재 — 실제 확인 필요), `cs-bridge.spec.ts`, `survey-response.spec.ts`, `admin-reports-tabs.spec.ts`
- Unit test 프레임워크 **없음** (`vitest.config.ts` 부재, 2026-04-24 머지 후 생겼을 가능성)
- **무테스트 핵심 플로우**:
  - `/admin/hrd/*` 전부
  - `/admin/cs-templates/[id]` 편집
  - `/admin/distribute/actions.ts` (1565줄, `createAdminClient()` 26회 호출)
  - `/admin` 대시보드 집계 정확성 (이번 주 발견된 퍼널 134% 버그 예방용)

### F. 타입 안전성

- `any` 사용 132회 중 실 소스 34회 (나머지는 `src/generated/prisma/` 자동 생성)
- 밀집: `/admin/page.tsx` alerts/customerMap/surveyRows, `distribute-tabs.tsx` (4회)
- **Supabase typed Database 미사용** — `.select("*")` + 수동 타이핑
- `@ts-ignore` 7곳
- ESLint config 파일 부재 (`.eslintrc.*`) — `npx eslint` 동작하긴 하나 기본 preset
- `tsconfig.json` `strict: true` 는 ON

### G. 코드 사이즈 / 복잡도

- 1500줄 이상 단일 파일:
  - `src/app/admin/distribute/distribute-tabs.tsx` ≈ 1734줄 (client)
  - `src/app/admin/distribute/actions.ts` ≈ 1565줄 (server actions, admin client 26회)
  - `src/app/admin/page.tsx` ≈ 540줄 (server component, 집계 로직 복잡)
- 분리 가능한 경계 뚜렷 (탭 단위, 액션 도메인 단위)

### H. 보안 · 검증

- `requireAuthAPI()` / `withAuth()` 대부분 적용, 2개 route 미검증 의심 (E 보고서 표현 — 후속 확인 필요)
- Zod 스키마 4개 (survey / distribution / customer / submission) — HRD 응답 저장 등 나머지 route 는 `req.json()` 원시 사용
- `.env.example` 부재 → 신규 클론 시 필수 env 파악 어려움
- RPC `search_path` 고정은 본 세션에서 새로 만든 3개 RPC 는 `set search_path = public` 확인, 기존 RPC 는 전수 미확인

### I. 기타

- 운영 npm audit 미정기 수행
- `node_modules/.cache/next-turbopack` 등 간헐 크래시 (Windows 한글 경로, AGENTS.md 에 기록됨) — 워크스페이스 이동 제안 누적
- lab/bris-explorer 브랜치의 미커밋 상태 (BRIS 진행물 + 로컬 참고 자산) 현재도 존재

---

## Part 2 · 로드맵 (우선순위 epic)

### Epic 1 — **Prisma Phase-out** (ROI 최고 · 범위 큼)

의존 관계상 가장 큰 부채. 단계별 진행.

- **1-A. Deprecated 경로 일괄 제거** (즉시)
  - `(dashboard)/surveys/**`, `(dashboard)/distribute/**`, `(dashboard)/reports/**`, `respond/[token]`, `survey/[token]`
  - `/api/respond/[token]` route 삭제
  - 검증: build pass, `/admin/*` 회귀 없음
- **1-B. `customers` 도메인 Supabase 이관**
  - Supabase 에 `customers` 테이블(또는 `edu_customers`?) 정의 → 기존 Prisma `Customer` 데이터 마이그레이션 스크립트 → `/admin/customers` 신규 페이지
- **1-C. `training` 도메인 이관** (customer FK 때문에 1-B 이후)
  - `TrainingRecord` → Supabase. `(dashboard)/training` + `/api/training/*` 대체
- **1-D. `interviews` 도메인 이관**
  - `Interview` → Supabase. `(dashboard)/interviews` + `/api/interviews/*` 대체
- **1-E. Prisma 완전 제거**
  - `src/lib/db.ts`, `src/lib/repositories/*`, `src/generated/prisma/` 삭제
  - `prisma/` 디렉터리 삭제
  - `package.json` 에서 `prisma`, `@prisma/client`, `@prisma/adapter-pg` 제거
  - `"build"` script 에서 `prisma generate &&` 제거

**예상 공수**: 1-A 반나절 / 1-B~D 각 1.5일 / 1-E 1일. 총 5~6일.

### Epic 2 — **관측성 기반 구축** (ROI 높음 · 낮은 리스크)

- `@vercel/analytics` + `@vercel/speed-insights` 루트 layout 에 설치 (30 분)
- Sentry 통합 (`@sentry/nextjs`) — server + client + edge 전부. DSN 은 env. 약 3시간
- Cron job 실패 알림:
  - Slack webhook 혹은 HIWORKS 이메일 (이미 env 에 있음)
  - 실패 시 retry 1회 + 알림
- `src/app/admin/hrd/error.tsx`, `src/app/admin/distribute/error.tsx` 추가
- 로깅 구조화 (`src/lib/logger.ts` — pino 또는 경량 유틸로 `console.log` 대체)

**예상 공수**: 총 2일

### Epic 3 — **테스트 베이스라인**

- vitest + @testing-library/react 도입 → Unit 시드 (날짜 유틸, Zod 스키마, aggregator)
- E2E 추가:
  - `/admin/hrd` 라운드·디자인 CRUD 스모크
  - `/admin/distribute` 이메일 발송 → 응답 토큰 유효성
  - `/admin` 대시보드 숫자 회귀 (퍼널 100% 초과 방지 regression 포함)
- CI (GitHub Actions) 에 test job 추가 — main push/PR 시 실행. Vercel 통과 후 테스트 실패 시 배포 블록은 별도 정책

**예상 공수**: 3일

### Epic 4 — **Lab / BRIS Graduation + 정리**

- `quality-timeline` 을 `/admin/ops/quality-timeline` (또는 `/admin/hrd/ops/`) 로 승격
  - admin client → 일반 createClient 로 전환 (RLS 정상화 완료)
- `bris_api_keys` 처분 결정 (영구 보존 vs drop) — session-handoff 과제 B 마감
- `mlops_*` 조인 뷰 `vw_classifier_quality` 생성 → findings 확장
- 남은 lab 탐색 페이지(archive/sync-status)는 유지 (findings 맥락)

**예상 공수**: 2일

### Epic 5 — **Migrations / 워크플로 위생**

- **5-A. untracked 2개 마이그레이션 커밋** (lab/bris-explorer 분할 시 또는 별도 chore 커밋)
- **5-B. AGENTS.md 규약 보강**
  - "신규 마이그레이션은 **반드시** 타임스탬프 형식" 재강조 + 중복 prefix 금지
  - idempotent 체크리스트 (`CREATE IF NOT EXISTS`, `DROP ... IF EXISTS`, `ALTER ... IF NOT EXISTS`) 명시
- **5-C. pre-commit hook (husky)** 도입
  - 신규 `.sql` 파일이 타임스탬프 형식인지
  - `DROP TABLE`, `TRUNCATE`, 조건 없는 `ALTER` 검출 시 경고

**예상 공수**: 1일

### Epic 6 — **대형 파일 리팩터**

- `distribute-tabs.tsx` (1734줄) 를 탭 단위 분할
  - `DistributeSendTab`, `DistributeBatchesTab`, `DistributeRemindTab` 등
- `distribute/actions.ts` (1565줄) 를 도메인 단위 서브모듈:
  - `actions/send.ts`, `actions/reminder.ts`, `actions/batch.ts` 등
- `/admin/page.tsx` getDashboardData 함수 600줄 → `src/lib/dashboard-aggregator.ts` 추출 (Unit test 가능)

**예상 공수**: 2일

### Epic 7 — **보안 · 검증 타이트닝**

- HRD 응답 저장 `/api/hrd/responses/save` Zod 스키마 도입
- 전 API route Zod 검증 여부 체크리스트 → 누락분 보완
- `.env.example` 작성 (모든 `process.env.*` grep 후 문서화)
- 기존 security definer RPC 전수 `search_path` 설정 감사
- RPC · RLS 정책의 `vercel`/`anthropic` 출처 외부 연동 테스트 (기존 회귀)

**예상 공수**: 1.5일

### Epic 8 — **타입 안전성 단계 상승**

- `npx supabase gen types typescript --linked > src/types/supabase.ts`
- `createClient` 에 `<Database>` generic 주입
- 기존 `.select("...")` 에서 `as any` / 수동 타입 제거
- ESLint `.eslintrc.mjs` 도입 + `@typescript-eslint/no-explicit-any` warn → err 단계적

**예상 공수**: 2일 (+ 도입 후 정리 스프린트 필요)

---

## Part 3 · Quick Wins (이번 주 내)

| # | 항목 | 공수 | 선행조건 |
|---|---|---|---|
| QW1 | untracked 마이그레이션 2개 커밋 (5-A) | 30 분 | lab/bris-explorer 의 stash 반영 이후 |
| QW2 | `.env.example` 추가 (7) | 30 분 | 없음 |
| QW3 | `@vercel/analytics` + `@vercel/speed-insights` 설치 (2) | 30 분 | 없음 |
| QW4 | `/admin/hrd/error.tsx`, `/admin/distribute/error.tsx` 추가 (2) | 30 분 | 없음 |
| QW5 | Deprecated `(dashboard)/surveys`·`distribute`·`reports` 삭제 (1-A) | 2 시간 | 없음 — DeprecatedBanner만 있는 페이지라 즉시 안전 |
| QW6 | `/api/respond/[token]`, `/respond/[token]`, `/survey/[token]` 삭제 (1-A) | 1 시간 | 없음 — JSDoc `@deprecated` |
| QW7 | Dashboard aggregator 함수 분리 + unit test 1건 (6 + 3 축소판) | 3 시간 | 없음 |

**총**: ≈ 1 일이면 소화 가능한 quick wins.

---

## Part 4 · 추천 실행 순서

관계 그래프:

```
QW (이번 주)  →  Epic 1-A (deprecated 제거, 1-B~E 준비)
            →  Epic 5 (마이그레이션 위생, PR 정책 단단히)
            ↓
Epic 2 (관측성)  +  Epic 3 (테스트 베이스) — 병렬 가능
            ↓
Epic 1-B ~ 1-E  (Prisma phase-out, 순차)
            ↓
Epic 4 (Lab graduation)
            ↓
Epic 6 (대형 파일 리팩터)  +  Epic 7 (보안)  +  Epic 8 (타입)
```

- **Sprint A (1 주)**: QW 전부 + Epic 5 + Epic 1-A
- **Sprint B (1–2 주)**: Epic 2 + Epic 3 + Epic 1-B (customers 이관)
- **Sprint C (2–3 주)**: Epic 1-C, 1-D, 1-E (training/interviews/Prisma 제거)
- **Sprint D (1 주)**: Epic 4 + Epic 7 + Epic 8 초반
- **Sprint E (지속)**: Epic 6 + Epic 8 마무리

---

## Part 5 · 측정 (Definition of Done 지표)

로드맵 완료 시 다음 지표로 검증:

- **빌드**: `npm run build` < 10 초 (현재 ~13초), First Load JS Shared 20% 감소
- **타입**: `grep "any" src/ --include="*.ts*"` 의 실소스 사용 34 → 10 이하
- **테스트**: Unit 30개+, E2E 8개+ (Sprint B 기준)
- **관측**: Sentry 이벤트 수집 중 / Cron 실패 Slack 알림 1회 이상 발송 검증
- **레거시**: `grep "prisma" package.json src/` → 0 매치
- **데이터**: Supabase `customers`, `training_records`, `interviews` 테이블 운영 데이터 100% 이전
- **문서**: `.env.example`, 업데이트된 AGENTS.md (Prisma 섹션 삭제, 마이그레이션 규약 강화)

---

## Part 6 · 트래킹

- 실행은 각 Epic 을 GitHub Issue 로 분할 후 label (`tech-debt`, `sprint-a|b|c|d|e`) 관리 권장
- 주간 review 는 `docs/dev/session-handoff-<YYYY-MM-DD>.md` 에 기록하는 기존 패턴 유지
- 본 문서는 **정적 로드맵**. 진행 상황은 commit 메시지 + session-handoff 에 흐른다

---

_작성: 2026-04-24 · 베이스라인 main HEAD `cc4c4f1` (PR #113 머지 직후) · 3 Explore 에이전트 병렬 조사 결과 종합_
