# Context — CS 대상자관리 ↔ 설문 배포 통합

> **이 문서는 불변 배경입니다.** 전제·구조·제약이 실제로 바뀌기 전까진 건드리지 마세요.
> 작업 진행 상황은 `worklog/`, 결정은 `decisions.md`, 설계는 `phase*-spec.md` 에.

**최종 확정일**: 2026-04-17

---

## 1. 배경 (Why)

사내 CS팀은 설문을 만들어 고객사 담당자(DM)에게 발송하고 응답을 수집한다. 현재 이 흐름이 **세 개의 단절된 시스템**에 걸쳐 수기로 이어지고 있다.

| 단계 | 담당 시스템 | 담당자 조작 |
|---|---|---|
| ① 원천 데이터 수집 | BRIS (사내 전용) | 브라우저로 페이지 열람 |
| ② 대상자 선정 (5단계 로직) | 로컬 HTML 툴 (`02. 대상자관리/`) | localStorage에 저장 |
| ③ 설문 발송·응답 수집 | Vercel 앱 (`survey_sd`) | 축소 CSV 수동 업로드 |

②→③ 사이 **축소 CSV를 다운로드해서 수동 재업로드**하는 단절점이 매달 발생. 이 단절을 없애고 장기적으로 ②, ③을 하나의 앱으로 통합하는 것이 목표.

---

## 2. 현재 상태 — "세 개의 섬"

### 섬 1: 로컬 HTML 툴 `02. 대상자관리/`
- `index.html` + `cs_v2_*.js` × 5 (단일 HTML, 외부 JS 분리)
- **localStorage** 기반 13개 정규화 엔터티
- BRIS 프록시 (`/default.asp?bris_proxy=`) 로 4-Phase 수집
- **5단계 대상자 선정**: 종료확인 → 최종차수 → 마감판정 → 중복검사 → 발송확정
- 출력: 축소 CSV 4열 (이름·소속·이메일·연락처) · 표준 CSV 11열 · XLSX
- **Supabase 호출 코드 0건** (완전 독립)

### 섬 2a: Supabase `cs_*` 파이프라인 (DB 스키마·뷰)
2026-04 시점 DB 실데이터:

| 테이블 | 행수 | 역할 |
|---|---|---|
| `cs_companies` | 61 | 회사 마스터 |
| `cs_business_places` | 73 | 사업장 |
| `cs_contacts` | 81 | DM(담당자) |
| `cs_projects` | 83 | 프로젝트 |
| `cs_courses` | 95 | 교육과정 |
| `cs_project_members` | 246 | 프로젝트 관계자 |
| `cs_target_batches` | 5 | 대상자 선정 배치 |
| `cs_survey_targets` | 80 | 5단계 선정 프로세스 추적 (step1~5 필드 완비) |
| `cs_dispatch_records` | 2 | 설문 발송 내역 |
| `cs_survey_participation` | 5 | 6개월 중복 방지 |
| `cs_external_send_history` | 0 | 외부 발송 이력 (CSV 주입) |
| `bris_endpoints` | 11 | BRIS API 정의 |
| `bris_sync_logs` / `bris_data` | 0 | (미사용) |

구축된 뷰: `v_cs_batch_dashboard`, `v_cs_dispatch_summary`, `v_cs_project_overview`, `v_cs_system_health`, `v_cs_target_candidates`, `v_cs_target_detail` — Phase 2에서 재사용 예정.

**`src/` 에서 `cs_survey_targets` 참조 코드 0건** — 스키마만 있고 앱이 읽지 않음.

### 섬 2b: `02. 대상자관리/참고/cs_dashboard.html` (**이것이 "다른 도구"**)
- 단일 HTML + 인라인 JS, Supabase JS CDN
- Supabase anon 키로 `cs_*` 테이블 직접 CRUD
- 대시보드 + 5단계 워크플로우 + 프로젝트·담당자 뷰 + BRIS 동기화 뷰
- 80 targets · 5 batches 데이터의 출처 = 이 도구
- **중요**: `dispatchSurvey()` 가 이미 `https://exc-survey.vercel.app/api/distributions/cs-bridge` 호출하도록 작성됨. 그러나 **엔드포인트가 survey_sd에 없음** → 현재 수기 CSV 운영 중. **Phase 1 핵심 과제 = 이 bridge API 구현**.
- bridge 계약(기대)
  - `POST /api/distributions/cs-bridge`
  - 헤더: `x-cs-bridge-key: <env>`
  - 요청: `{ batchId, channel: 'auto'|'email'|'sms', targets: [{targetId, contactId, name, email, phone, company, department, position, courseId, projectId}] }`
  - 응답: `{ dispatched, skipped, errors, results: [{targetId, distributionId, token, surveyUrl, channel, status, reason}] }`
- bridge가 기록하는 cs_survey_targets 확장 컬럼 (현재 테이블에 **미존재**, Phase 1에서 추가): `distribution_id`, `survey_token`, `survey_url`, `dispatched_at`, `dispatch_channel`, `dispatch_error`

### 섬 3: Vercel 앱 `survey_sd/` (현재 배포 중)
- Next.js 16 App Router · Prisma 7 · Supabase Postgres · 한국 리전
- 발송 관련 테이블:
  - `surveys` → `distribution_batches` → `distributions` (recipient_name/email/phone/company/department/position)
- 자체 UI로 CSV 업로드 → 개인 링크 생성 → SMS/이메일 발송 → 응답 수집
- **`cs_*` 파이프라인 참조 없음**

---

## 3. 스코프

| Phase | 목표 | 범위 |
|---|---|---|
| **Phase 1** (단기) | cs-bridge API 구현 | survey_sd에 `POST /api/distributions/cs-bridge` 엔드포인트 구현. `cs_survey_targets` 확장 컬럼 마이그레이션. `cs_target_batches ↔ surveys` 연결. 결과 = cs_dashboard의 "설문 발송" 버튼이 실제로 작동. CSV import UI는 **Phase 1-b** 보조 레인 (cs_dashboard 사용 불가 시). |
| **Phase 2** (중기) | survey_sd 안으로 대상자 관리 흡수 | `/admin/cs-targets` 섹션 신설 — 배치 목록·상세·5단계 상태·발송 UI. 응답 수신 시 `cs_survey_participation`·`cs_survey_targets` write-back. Prisma 스키마에 cs_* 반영. `cs_dashboard.html` 은 유지하되 주요 운영은 앱 쪽으로 이동. |
| ~~Phase 3~~ (장기, 본 스코프 제외) | BRIS 수집 서버 이관 + 로컬 툴 폐기 | 사내망 제약으로 별도 검토 |

### 스코프 아웃
- BRIS 수집의 서버측 자동화 (사내망 제약)
- 로컬 HTML 툴의 즉시 폐기 (당분간 병행 운영)

---

## 4. 제약조건

| # | 제약 | 영향 |
|---|---|---|
| C1 | **BRIS는 사내 네트워크에서만 접근 가능** | 수집 단계는 사내 단말(브라우저 또는 프록시) 필요. Vercel Functions에서 직접 fetch 불가. |
| C2 | **현재 대시보드용 "다른 도구"가 수기로 `cs_*` 데이터 유지 중** | Phase 2에서 로컬 v2가 Supabase 쓰기 시 기존 데이터·도구와 충돌 방지 필요 |
| C3 | **로컬 v2 HTML 툴은 당분간 유지** | Phase 2에서도 앱과 병행 작동해야 함. 장기적으로만 앱에 흡수 |
| C4 | **Vercel Functions — 기본 300s 타임아웃, Fluid Compute** | 대량 import 시 배치 처리·비동기 큐 고려 |
| C5 | **Supabase RLS 활성화** | 모든 테이블에 적절한 정책 필요 |
| C6 | **개인정보 포함** | 이름·이메일·연락처·회사 저장·전송. 최소한의 보관 정책 명시 |

---

## 5. 기술 스택 (survey_sd)

- Next.js 16.2.1 App Router (Turbopack)
- React 19.2
- Prisma 7.5 + @prisma/adapter-pg (Supabase Postgres)
- `@supabase/ssr`, `@supabase/supabase-js`
- 배포: Vercel (프로젝트 `exc-survey`, team `daun92s-projects`, production = `main`)
- Supabase 프로젝트: `cs-survey` / ref `gdwhbacuzhynvegkfoga` / ap-northeast-2
- SMS 발송: PPURIO / 이메일: nodemailer + HIWORKS
- Cron: Vercel Crons (`/api/cron/send-emails`, `/api/cron/send-sms` 매일 09:00)

### 주의 (AGENTS.md)
Next.js 16은 기존 지식과 breaking changes 많음. `node_modules/next/dist/docs/` 의 가이드를 먼저 읽고 작업. Deprecation 경고 준수.

---

## 6. 핵심 연결점

### Phase 1 (cs-bridge API)
```
[cs_dashboard.html · 섬 2b]
  5단계 워크플로우에서 대상자 확정
     ↓ 사용자 "설문 발송" 클릭
  dispatchSurvey()
     ↓ fetch POST
  [survey_sd · Phase 1 신규]
  POST /api/distributions/cs-bridge
     ↓ 재검증 (x-cs-bridge-key, cs_survey_targets.is_eligible/step5_confirmed)
     ↓ distribution_batches 생성·조회 (source='cs-bridge', source_batch_id=batchId)
     ↓ distributions upsert (targetId당 1건, unique_token 생성)
     ↓ 응답 {results[]} 반환
  [cs_dashboard.html writeback]
  cs_survey_targets.distribution_id / survey_token / survey_url / dispatched_at 업데이트
     ↓
  (기존) SMS/Email 발송 큐, 응답 수집
```

### Phase 2 (survey_sd 내 UI + write-back)
```
[survey_sd · 신규 /admin/cs-targets]
  배치 목록 (v_cs_batch_dashboard)
  배치 상세 (v_cs_target_detail, 5단계 상태)
     ↓ "설문 발송" 버튼 (cs-bridge API 내부 호출)
  distribution_batches + distributions 생성 (Phase 1과 동일 경로)
     ↓ 발송·응답
  응답 submit 훅에서 writeback:
     cs_survey_participation upsert (6개월 방지)
     cs_survey_targets.response_* 업데이트 (옵션)
     cs_dispatch_records 로그
```

---

## 7. 용어 사전

| 용어 | 정의 |
|---|---|
| **v2** / **로컬 v2** | `02. 대상자관리/index.html` + `cs_v2_*.js` (localStorage 기반 HTML 툴) |
| **앱** / **survey_sd** | Vercel에 배포된 Next.js 앱 (`exc-survey` 프로젝트) |
| **Target batch** | `cs_target_batches` 한 행 — 특정 기간의 대상자 선정 단위 (월별) |
| **Target** | `cs_survey_targets` 한 행 — 1 DM × 1 배치 (5단계 상태 포함) |
| **Distribution batch** | `distribution_batches` 한 행 — 발송 단위 (survey_sd 기존) |
| **Distribution** | `distributions` 한 행 — 1 개인 링크 (survey_sd 기존) |
| **DM** | Decision Maker — 고객사 담당자 (`cs_contacts`) |
| **BRIS** | 사내 기간계 시스템 (사내망 전용) |

---

## 8. 업데이트 정책

이 문서는 **불변 배경**입니다. 다음 중 하나가 실제로 일어났을 때만 수정:
- 새 제약이 발견 (예: Supabase plan 변경, 새 규제)
- 네 번째 섬이 생기거나 기존 섬이 사라짐
- Phase 스코프가 공식 변경 (→ `decisions.md`에 ADR 추가 후 여기 반영)

진행 상태·WIP·다음 작업 등은 **worklog에** 쓰고 여기에 쓰지 마세요.
