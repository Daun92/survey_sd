# 04. Sync 엔드포인트 (2종)

Sync 는 **"BRIS 에서 가져온다 + Supabase 에 쓴다"** 를 한 번의 호출로 묶습니다. Parse 는 순수 변환만 했다면, Sync 는 **DB 에 실제 반영되는 파괴적 작업** 이므로 주의하세요.

## 공통 규격

| 항목 | 값 |
|------|-----|
| 인증 | ✅ `X-API-Key` |
| 메서드 | `POST` |
| Content-Type | `application/json` |
| 성공 응답 | `200` + `SyncResult` 객체 |
| 실패 응답 | `500 Sync failed: ...` / `401` |

## 사전 요건 — 환경변수

Parse 와 달리 Sync 는 **외부 시스템(BRIS + Supabase) 에 접근**하기 때문에 env 가 더 필요합니다.

| 변수 | 필수? | 용도 |
|------|-------|------|
| `BRIS_API_KEY` | ✅ 항상 | 이 서버 인증 |
| `BRIS_USER_ID`, `BRIS_PASSWORD` | `/v1/sync` 때 (택 1) | BRIS 로그인 |
| `BRIS_COOKIE_FILE` | `/v1/sync` 때 (택 1) | BRIS 쿠키 JSON (컨테이너 내 `/secrets/bris_cookies.json`) |
| `SUPABASE_URL` | 모든 sync | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | 모든 sync | service_role 키 (RLS 우회) |

> `/v1/sync/from-html` 은 HTML 을 클라이언트가 전달하므로 **BRIS 자격증명이 필요 없습니다**. Supabase 자격증명만 있으면 됩니다.

## 1. `POST /v1/sync` — 날짜 범위 기반

BRIS 에 로그인 → 해당 기간 통합 페이지 fetch → 파싱 → Supabase upsert.

**요청 바디** (`SyncRequest`):

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `startDate` | string (YYYY-MM-DD) | ✅ | - | 시작일 (포함) |
| `endDate` | string (YYYY-MM-DD) | ✅ | - | 종료일 (포함) |
| `autoBatch` | bool | ❌ | `true` | sync 후 CS 배치 후보 자동 생성 |

**예시**:

```sh
curl -X POST http://localhost:8000/v1/sync \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-04-01",
    "endDate": "2026-04-30",
    "autoBatch": true
  }'
```

## 2. `POST /v1/sync/from-html` — 로컬 HTML 기반

BRIS 에 붙지 않고 클라이언트가 미리 받아둔 HTML 을 그대로 주입. **BRIS 가 접근 불가인 환경 / 재처리 / 수동 디버깅** 용도.

**요청 바디** (`SyncFromHtmlRequest`):

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `html` | string | ✅ | - | BRIS 통합 페이지 HTML 원문 |
| `periodStart` | string | ❌ | `null` | 로그/메타용 (실제 필터링은 안 함) |
| `periodEnd` | string | ❌ | `null` | 로그/메타용 |
| `autoBatch` | bool | ❌ | `false` | 기본값이 false 인 점 주의 |

**예시**:

```sh
HTML_PAYLOAD=$(jq -Rs . < lib/bris-parser/test/fixtures/integrated_basic.html)

curl -X POST http://localhost:8000/v1/sync/from-html \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"html\": $HTML_PAYLOAD,
    \"periodStart\": \"2026-04-01\",
    \"periodEnd\": \"2026-04-30\",
    \"autoBatch\": false
  }"
```

## 응답 — `SyncResult`

두 엔드포인트 모두 동일한 응답 모델:

| 필드 | 타입 | 의미 |
|------|------|------|
| `sync_id` | string? | 이번 sync 레코드 ID (Supabase `sync_log.id`) |
| `total_records` | int | BRIS 에서 가져와 파싱한 레코드 수 |
| `companies` | int | upsert 한 회사 수 |
| `places` | int | upsert 한 장소 수 |
| `contacts` | int | upsert 한 담당자 수 |
| `projects` | int | upsert 한 프로젝트 수 |
| `courses` | int | upsert 한 교육과정 수 |
| `members` | int | upsert 한 수강생 수 |
| `batch_id` | string? | `autoBatch=true` 인 경우 생성된 CS 배치 ID |
| `auto_candidates` | int | 배치에 편입된 후보자 수 |
| `errors` | string[] | 부분 실패 항목 (전체 실패 시엔 500) |

**응답 예시 (성공)**:
```json
{
  "sync_id": "3f1c8a1e-...",
  "total_records": 482,
  "companies": 87,
  "places": 92,
  "contacts": 203,
  "projects": 14,
  "courses": 22,
  "members": 482,
  "batch_id": "batch_2026_04",
  "auto_candidates": 128,
  "errors": []
}
```

**응답 예시 (부분 실패)**:
```json
{
  "sync_id": "3f1c8a1f-...",
  "total_records": 482,
  "companies": 85,
  "places": 92,
  "contacts": 203,
  "projects": 14,
  "courses": 22,
  "members": 481,
  "batch_id": null,
  "auto_candidates": 0,
  "errors": [
    "company upsert failed: ... (code CUST997)",
    "member row 412: duplicate key"
  ]
}
```

→ HTTP 200 이지만 `errors` 비어있지 않으면 **부분 반영**입니다. 운영자는 `errors` 를 반드시 확인.

## 운영 주의

### 1) 중복 실행 시 멱등성

`upsert` 기반이므로 같은 기간을 두 번 호출해도 레코드가 **중복 생성되지 않습니다**. 단, `sync_log` 에는 두 개의 sync_id 가 남습니다.

### 2) `autoBatch=true` 의 부작용

- `batch_id` 가 새로 생성되며 `auto_candidates` 명이 배치에 편입됩니다.
- 같은 월 배치가 이미 존재하면 **새 배치가 하나 더 생기므로** 관리 콘솔에서 중복 배치가 보일 수 있습니다. 재실행 시엔 `autoBatch=false` 권장.

### 3) 장기 실행 고려

기간이 길거나 레코드 수가 많으면 응답이 수십 초 소요될 수 있습니다. 프런트엔드 timeout 은 **최소 60초** 를 권장. 비동기화가 필요해지면 Phase 5 의 job queue 구조로 전환 필요.

### 4) 쿠키 만료

`BRIS_COOKIE_FILE` 방식에서 쿠키가 만료되면 500 + `Sync failed: ... 401` 이 반환됩니다. 새 쿠키로 덮어쓰기 후 `docker compose up -d`.

### 5) 에코 제외 사유별 자동 처리 (2026-04-15 이후)

파서가 BRIS 의 **에코 제외 사유** 를 별도 필드(`echoExcludeReason`) 로 추출해 `cs_projects.echo_exclude_reason` 에 저장합니다. Supabase RPC `fn_cs_post_sync_auto_batch` 가 CS 대상자 선정 시 아래 규칙으로 자동 처리 (DB 마이그레이션 `supabase/migrations/20260415_enhance_auto_batch.sql` 적용 후 활성화):

| 조건 | 처리 | `cs_survey_targets.status` | 사유 표시 |
|------|------|----------------------------|-----------|
| `echo_exclude_reason ILIKE '%집체%특강%'` (짧은 집체 특강) | **자동 배제** | `excluded` | `단기 특강 (자동)` |
| `email IS NULL AND mobile IS NULL` (연락처 무) | **자동 배제** | `excluded` | `연락처 없음 (자동)` |
| 그 외 (외부망 차단 / 팀빌딩 / 기타 / 사유 없음 등) | 정상 Step 2~4 심사 흐름 | `pending` | — |

> **자동 배제는 위 2가지만**. `고객사 외부망 차단`, `집체(4시간 팀빌딩)`, `기타` 같은 사유는 `echo_exclude_reason` 컬럼에 그대로 보존되어 운영자가 사후 참조에 활용하되, 자동으로 대상자에서 빼지는 않습니다 (운영팀 정책, 2026-04-15 합의).

**실 데이터 분포** (2026-04-01~15 dry-run 89건 기준): 18건 외부망 차단 · 4건 집체 특강 · 3건 기타 · 2건 팀빌딩 · 1건 fallback. → 자동 배제는 4건 (집체 특강) 만 적용.

마이그레이션은 DRAFT 상태 — 적용 전 운영자 검토 필요. Supabase Studio SQL Editor 에서 직접 수행 권장.

## 다음

- 에러 응답 해석 → [`05-error-codes.md`](./05-error-codes.md)
- Python / JS 에서 호출 → [`06-client-examples.md`](./06-client-examples.md)
