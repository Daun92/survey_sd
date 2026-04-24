# Session Handoff — 2026-04-24

> 이 문서 한 장으로 다음 세션이 현재 상태·남은 작업·시작 명령·결정 대기 항목을 파악할 수 있어야 한다.
> 선행 세션 핸드오프: `docs/dev/session-handoff-2026-04-23.md` (PITR 사고 + mlops/bris_api_keys 수습)

## TL;DR

- **A 안정화 스프린트 완료** (7 PR): N+1 제거, 트랜잭션 롤백, react-hooks 0건, 거대 모듈 분할, report-aggregator 추출, lint blocking 복원, e2e 1건 추가.
- **B 로드맵 자율 착수 가능분 완료** (4 PR): HRD dashboard status 버그, HRD survey-form 컴포넌트 분할, HRD design 수정 폼, 응답자 타임라인 페이지.
- **모든 11 PR 의 DB 영향 0건**: 기존 응답·배부·응답자 row 의 UPDATE/DELETE 없음, 신규 마이그레이션 없음. 안전한 코드-only 리팩터 + UI 보완.
- **남은 B 로드맵**: 코드 작업 가능 1건 (B-3-2 미응답자 탭), 외부 coordination 대기 3건 (B-1 실발송, B-2 BRIS, B-3-3 블랙리스트).
- **다음 세션 첫 명령**: `git fetch origin main && git log --oneline origin/main -12` 로 오늘 작업 merge 상태 재확인 → 본 문서 §남은 B 로드맵 중 🟡 표시된 과제부터 pick.

## 오늘 세션 결과 — 11 PR merged

### A 안정화 스프린트 (plan `cheeky-painting-sprout.md`)

| PR | 제목 | 주요 수치 |
|---|---|---|
| #100 | perf(distribute): 재발송 배치 N+1 제거 | 1,000건 기준 SELECT 2,001 → 2회 |
| #101 | fix(lint): react-hooks 9건 해소 + deprecated 4 페이지 삭제 | eslint react-hooks 0 errors, -1,107줄 |
| #102 | fix(distribute): batch orphan 롤백 | compensating delete |
| #103 | refactor(reports): 집계 로직 lib 추출 + 단위 테스트 | page.tsx 442→226, unit tests 8/8 |
| #104 | refactor(distribute): SMS 블록 분리 (A-2-a Phase 1) | actions.ts 1,597→965 |
| #105 | chore(ci): lint blocking 복원 + e2e 중복제출 | `continue-on-error: true` 제거 |
| #106 | refactor(distribute): Email 블록 분리 (A-2-a Phase 2) | **actions.ts 965→368 (-77% vs 원본 1,597)** |

### B 로드맵 자율 착수분

| PR | 제목 | 비고 |
|---|---|---|
| #107 | fix(admin-hrd): dashboard status 필터 (collecting + fallback) | `status='active'` 하드코딩 → 실제 enum |
| #108 | refactor(hrd): survey-form answer_type 컴포넌트 분할 | 481→296줄, 신규 `<AnswerTypeInput>` |
| #109 | feat(admin-hrd): design 페이지 파트/문항 수정 폼 | 기존 서버 액션은 있었음, UI 만 추가 |
| #110 | feat(admin-respondents): 응답자별 타임라인 페이지 | 신규 `/admin/respondents/[id]/timeline` |

## 레포 현재 상태 (2026-04-24 기준)

### 주요 디렉터리 변동

```
src/app/admin/distribute/
├── actions.ts            368줄  — 공통 배부 배치 관리 (create/add/get/delete/updateLabel)
├── email-actions.ts      604줄  — 이메일 12 함수 + SMTP_PRESETS
├── sms-actions.ts        640줄  — SMS 12 함수
└── ...                            기존 UI 파일들 (import 경로는 각 채널별 파일로 분기)

src/lib/
├── report-aggregator.ts  280줄  — 순수 집계 함수 (Supabase 비의존)
└── report-aggregator.test.ts    vitest 8 케이스

src/components/hrd/
└── answer-type-input.tsx 244줄  — 9 answer_type 렌더러 (HrdSurveyItem 기반)

src/app/admin/respondents/
├── page.tsx
├── respondent-client.tsx          Activity 아이콘 → timeline 링크
├── [id]/timeline/page.tsx         신규 — 3종 이력 통합 타임라인
└── actions.ts
```

### CI/Lint 정책

- `.github/workflows/ci.yml` 의 4 job (typecheck / lint / unit / build) 모두 **blocking**.
- `eslint.config.mjs` 에서 `@typescript-eslint/no-explicit-any` 는 `error → warn` 완화 (pre-existing 71건 점진 청소 대상).
- `react-hooks/*` 전체 0건 유지, 신규 회귀 시 CI 차단.

### E2E 스펙 (`e2e/`)

- `cs-bridge.spec.ts` · `survey-response.spec.ts` · `survey-builder.spec.ts` · `admin-reports-tabs.spec.ts` · `admin-distribute.spec.ts`
- **신규 (오늘 #105)**: `respond-submit-duplicate.spec.ts` — `/d/[token]` 재제출 400 회귀 방지

### 유지되는 결정 (선행 세션에서 박제)

- `bris.*` 스키마 복구 포기, `bris_api_keys` 보존 + RLS 잠금 (2026-04-23)
- `mlops_*` 6테이블 RLS 정상화 완료 (2026-04-23)
- 원격 Supabase schema_migrations 는 **14자리 타임스탬프 버전** 만 사용 (CLI `db push` 와 동기)

## 남은 B 로드맵 — 과제별 상세

### B-3-2 · 미응답자 대시보드 탭 — 🟡 자율 실행 가능

**목적**: 배포 배치 단위로 "아직 응답하지 않은 대상자" 리스트·필터·Excel export 제공. 현재는 `/admin/distribute/[batchId]` 상세 화면에서 전체 목록만 보여주고 미응답자 필터 UX 부재.

**위치 후보 2개** (한 쪽 선택):

A. `src/app/admin/reports/ReportTabs.tsx` 에 6번째 탭 "미응답자" 추가
  - 장점: 리포트 동선에 자연스러움
  - 단점: survey 단위 (batch 단위 아님)

B. `src/app/admin/distribute/distribute-tabs.tsx` 의 배치 상세 패널에 "미응답자만" 필터 버튼
  - 장점: batch 단위로 자연스러움, 기존 테이블 재사용
  - 단점: 현재 파일 1,700줄+ (이미 복잡)

**제안**: B 쪽. B-3-1 의 `respondent-timeline` 컴포넌트 일부를 재사용하면서 `/admin/distribute/[batchId]` 경로의 data-table에 `filter=unresponded` searchParam 추가.

**데이터 소스**:
```ts
// 미응답 distributions 조회
supabase.from("distributions")
  .select("id, recipient_name, recipient_email, recipient_phone, status, sent_at, opened_at, respondent_id")
  .eq("batch_id", batchId)
  .neq("status", "completed")
  .order("sent_at", { ascending: false })
```

**착수 단계**:
1. `distribute-tabs.tsx` 에서 `distributions` 조회 로직 위치 파악 (`fetchDistributions` 호출)
2. 필터 토글 버튼 + URL searchParam 동기화 (plan 의 URL 상태 동기화 규약 준수)
3. Excel export: 기존 CSV export 스타일 (`xlsx` 라이브러리 이미 dev dep 에 존재) 로 구현
4. e2e: 배포 배치 하나 seed → 일부만 completed 처리 → filter 적용 후 미완료 row 만 나오는지 검증 (생략 가능)

**예상 크기**: 1 PR, 300줄 내외.

**선행 조건**: 없음. 즉시 시작 가능.

---

### B-3-3 · 블랙리스트 (bounce 로그) — 🔴 B-1 실발송 의존

**목적**: 메일/SMS bounce 콜백 또는 반환 코드를 수집해 다음 발송 시 자동 제외. 현재는 `last_error` 만 queue 테이블에 남고 영구 로그 없음.

**위치 (예정)**:
```
supabase/migrations/YYYYMMDDHHMMSS_bounce_logs.sql
  - email_bounce_log (email, reason, provider, bounced_at, distribution_id)
  - sms_bounce_log (phone, reason, provider, bounced_at, distribution_id)

src/lib/email/bounce-handler.ts   — 프로바이더 webhook/return code 파싱
src/lib/sms/bounce-handler.ts

src/app/api/webhooks/hiworks-bounce/route.ts  — HiWorks 콜백 수신
src/app/admin/distribute/actions.ts            — 발송 전 bounce_log 체크 추가
```

**착수 단계**:
1. HiWorks / Aligo / Ppurio 의 bounce 콜백 스펙 확인 (운영팀 문서 대기)
2. migration 작성 — 두 테이블 + RLS (service_role DML, authenticated SELECT)
3. queue insert 경로 전후에 bounce_log 조회 → skip
4. webhook 라우트 (운영팀이 콜백 URL 등록 후 검증 가능)

**선행 조건**:
- **B-1 완료 필수** — 실발송 없으면 bounce 발생 0, 테스트 불가
- 운영팀의 프로바이더별 bounce 콜백 스펙 / 반환 코드 매핑 자료

**결정 대기** (plan E-4):
- hard bounce 즉시 차단 vs N회 실패 후 차단 — 정책 미정

---

### B-1 · SMS/Email 실발송 go-live — 🔴 운영팀 credentials 대기

**목적**: 현재 Mock 으로 동작 중인 이메일·SMS 발송을 실제 프로바이더(HiWorks, Aligo, Ppurio) 로 전환.

**현재 구현 완성도**: 95%. 코드·DB 테이블·cron·재시도 모두 있음. 설정 데이터만 없음.

**관련 위치**:
- `src/lib/email/sender.ts` — HiWorks API 연동, SMTP 프리셋
- `src/lib/sms/sender.ts` — Aligo + Ppurio (토큰 캐시 포함)
- `src/app/api/cron/send-emails/route.ts` · `/send-sms/route.ts` — 이미 DB `email_providers`/`sms_providers` 조회하여 동적 선택
- `supabase/migrations/023_email_providers.sql`
- `supabase/migrations/025_sms_providers_and_queue.sql`

**착수 단계 (1주 예상)**:
1. 운영팀과 프로바이더 자격증명 확정
   - HiWorks: Office Token + User ID
   - Ppurio 또는 Aligo: API key + sender_phone
2. 운영 환경 Vercel env vars 등록:
   ```
   HIWORKS_OFFICE_TOKEN / HIWORKS_USER_ID
   PPURIO_USERNAME / PPURIO_TOKEN / PPURIO_SENDER_PHONE  (또는 ALIGO_*)
   ```
3. `email_providers` / `sms_providers` 초기 row insert
   - **migration 으로 하지 않음** — credential DB 저장 구조이므로 운영 환경 한정 수동 insert
   - RLS 확인: service_role 만 쓰기 가능 여부
4. Staging 에서 소량 발송 (2~3건) 후 로그 검증
5. Vercel cron 활성화 (`vercel.json` 에 이미 스케줄 존재 — 실발송만 스위치)

**선행 조건**: 운영팀 credentials.

**리스크**: `email_providers` 테이블에 평문 credential 저장 구조. Vault/KMS 도입은 **후순위 과제** 로 별도 PR (이 go-live 에 블로킹하지 않음).

---

### B-2 · BRIS 대상자 파이프라인 정식 편입 — 🔴 자격증명 + 운영 주체

**목적**: `/admin/lab/bris/*` read-only 관찰 UI 를 넘어 실제 수집 → 대상자 선정 → 배포 편입까지의 월간 운영 개시.

**현재 구현 완성도**: 수집 인프라 100% (별도 레포 `bris-api-server` FastAPI Docker). UI 관찰용 lab 완성. 실운영 미개시.

**관련 위치**:
- 별도 레포: `C:\Users\EXC\Downloads\cs\target\bris-api-server` (Docker, FastAPI)
- 본 레포: `docs/dev/bris-collection-sources.md` · `bris-collection-roadmap.md` · `bris-collection-runbook.md` · `bris-lab.md`
- 현 UI: `src/app/admin/lab/bris/*` (quality-timeline / sync-status / archive)
- 보존된 자산: `public.bris_api_keys` (11행, 2026-04-23 결정)
- 수집 타깃 테이블: `cs_companies` / `cs_business_places` / `cs_contacts` / `cs_projects` / `cs_courses` / `cs_project_members` / `cs_survey_targets`

**3-Phase 착수 단계**:

**Phase α · 운영 개시 (2주)**
1. BRIS 자격증명 안전 보관 결정 — 1Password / Supabase Vault / 사내 PC 로컬 중 택1
2. Docker 실행 주체 확정 — 누가 월 1회 `/v1/sync` 트리거
3. 2026-04 데이터 첫 sync → `cs_contacts` · `cs_survey_targets` 80+ 행 갱신 확인
4. MLOps 지표 (`/admin/lab/bris/quality-timeline`) 로 품질 관측 시작

**Phase β · 백필 (2주)**
- 2023-01 ~ 현재 월별 순차 `/v1/sync` (자동 배제 규칙 `echo_exclude_reason` 일괄 적용)

**Phase γ · 정식 편입 (1주)**
- `/admin/lab/bris` → `/admin/bris` graduation (경로 변경, 네비 노출)
- `/admin/distribute` 에서 `cs_survey_targets.status='selected'` 를 대상자 소스로 직접 선택 가능한 UI

**선행 조건**:
- BRIS 웹 자격증명
- Docker Desktop 실행 가능한 사내 PC + 실행 주체 지정
- MLOps 파이프라인 소스 파악 (`mlops_*` 갱신 주체 — 현재 불명)

**결정 대기** (plan E-2): 운영 주체 미지정

## 결정 대기 항목 (plan `cheeky-painting-sprout.md` E-section, 2026-04-24 기준 재확인)

| # | 결정 항목 | 영향받는 작업 |
|---|---|---|
| E-1 | ~~A 스프린트를 이번 주부터 착수할지, B-1 먼저 운영팀과 맞춰둘지~~ | **해소** — A 완료 |
| E-2 | **B-2 BRIS 운영 주체**: 매월 Docker 수동 실행 담당자 | B-2 전체 차단 |
| E-3 | **B-4 HRD 구체화 4 대 도메인 질문**: 다년도 추적/벤치마크/리포트 고객/AI 권고 방식 | B-4 통계 페이지 확장 차단 (즉시 정비는 오늘 완료) |
| E-4 | **B-3 블랙리스트 정책**: hard bounce 즉시 차단 vs N회 실패 후 차단 | B-3-3 구현 형태 결정 |

## 기술 부채 follow-up (자율 진행 가능, 우선순위 낮음)

| 항목 | 위치 | 스코프 |
|---|---|---|
| A-2-a Phase 3 · MessageProvider 추상화 | `src/app/admin/distribute/{email,sms}-actions.ts` | email/SMS 의 유사 패턴 (schedule/sendTest/resend/providers CRUD) 을 공통 인터페이스로 흡수. Phase 1-2 로 파일이 분리된 후 shape 이 명확해져 검토 용이. |
| any → Zod/타입 점진 치환 | 71건, 약 15개 파일 | `@typescript-eslint/no-explicit-any` warn 으로 마스킹된 건들. `admin/distribute/*`, `admin/reports`, AI 라우트 중심. |
| distribute-flow e2e (CSV → queue) | `e2e/distribute-flow.spec.ts` 신규 | Playwright 파일 업로드 + multi-context. A-4 에서 scope 초과로 deferred. |
| 타임라인 컴포넌트 재사용 | `src/app/admin/respondents/[id]/timeline/page.tsx` 일부 추출 | B-3-1 의 `TimelineIcon`/`TimelineBadge`/`TimelineDetail` 을 `src/components/timeline/*` 로 승격 후 B-3-2 미응답자 탭·배포 배치 상세에서 재사용 |
| answer-type 공용화 (HRD → edu) | `src/components/hrd/answer-type-input.tsx` | 교육 설문 응답자 폼도 동일 패턴으로 변환. HRD 의 answer_type 과 edu_questions.question_type 의 매핑 테이블 필요. |
| HRD answer_options 편집 UI | `src/app/admin/hrd/design/design-actions.tsx` | 단일/복수 선택지의 label/value 편집 UI (현재는 DB 직접 편집 필요) |
| HRD 설계 reorderItems 드래그앤드롭 | `actions.ts` 에 서버 액션 이미 존재 | `@dnd-kit` 도입 여부 검토 |
| survey-list-client 드롭다운 useLayoutEffect | `src/app/admin/surveys/survey-list-client.tsx` L170-180 | A-1-c 에서 eslint-disable 로 처리. 정식 수정 스코프. |
| lint cleanup — 미사용 import 등 | 각종 warning 55건 | low 우선순위 |

## Resume 체크리스트 — 다음 세션 시작 시 실행

```bash
# 1. 최신 main 확인
git fetch origin main --quiet
git log --oneline origin/main -12

# 2. 열린 PR 확인
gh pr list --state open --json number,title,mergeable,mergeStateStatus

# 3. CI 정책 재확인 (본 문서 §레포 현재 상태)

# 4. 본 문서의 §남은 B 로드맵 에서 🟡 (코드 가능) 선택 → 착수
#    또는 §결정 대기 항목 재확인 후 운영팀과 coordination
```

**첫 선택지**: B-3-2 미응답자 대시보드 탭 (코드-only, 선행 조건 없음).

## 데이터 안전성 요약

이 세션 11 PR + 앞으로의 모든 B 작업은 **기존 축적 데이터** (`edu_submissions`, `edu_answers`, `distributions`, `respondents`, `hrd_*`) 의 **UPDATE/DELETE 를 일으키지 않는다**. B-1 실발송 go-live 는 신규 row 를 INSERT 만 하고, B-3-3 bounce 는 신규 테이블에만 기록한다. 향후 작업 선택 시 이 원칙을 기본으로 유지할 것 — 데이터 스키마 변경이 필요한 작업은 별도 PR 로 분리하고 PR 본문의 "DB 영향" 섹션에 명시.
