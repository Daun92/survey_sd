# 03. Parse 엔드포인트 (8종)

BRIS HTML 한 페이지 → JSON 으로 1회 변환. **DB 저장은 하지 않음** (저장은 sync 엔드포인트 담당).

## 공통 규격

| 항목 | 값 |
|------|-----|
| 메서드 | `POST` |
| 경로 | `/v1/parse/{kind}` |
| 인증 | ✅ `X-API-Key` |
| 요청 본문 | **두 방식 택1** — raw HTML (`Content-Type: text/html`) 또는 JSON `{"html": "..."}` (`Content-Type: application/json`) |
| 성공 응답 | `200` + 파서별 JSON |
| 실패 응답 | `400 Parse failed: ...`, `401`, `422` (JSON 포맷 불일치), `500` — 세부는 [`05-error-codes.md`](./05-error-codes.md) |

## 엔드포인트 일람

| # | Path | 입력 페이지 | 응답 형태 | 레퍼런스 픽스처 |
|---|------|-------------|-----------|-----------------|
| 1 | `/v1/parse/integrated` | BRIS 통합 월별 HTML | **한글 키** records[] | `lib/bris-parser/test/fixtures/integrated_basic.html` |
| 2 | `/v1/parse/integrated/camelcase` | 동일 | **camelCase** records[] | 동일 |
| 3 | `/v1/parse/edu-detail` | 교육세부 HTML | object | `edu_detail.html` |
| 4 | `/v1/parse/echo-view` | 에코뷰 HTML | object | `echo_view.html` |
| 5 | `/v1/parse/echo-data` | 에코데이터 HTML | object (schedules 포함) | `echo_data.html` |
| 6 | `/v1/parse/project-detail` | 프로젝트 세부 HTML | object | `project_detail.html` |
| 7 | `/v1/parse/project-biz` | 프로젝트-영업 HTML | sessions[] | `project_biz.html` |
| 8 | `/v1/parse/dm` | DM 상세 HTML | object | `dm.html` |

## 1, 2번 — `integrated` / `integrated/camelcase`

BRIS **통합 페이지** 파서. 전체 교육 일정 레코드 배열을 반환.

**요청** (raw HTML):
```sh
curl -X POST http://localhost:8000/v1/parse/integrated/camelcase \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/integrated_basic.html
```

**응답 (camelcase 버전, 레코드 1개 발췌)**:
```json
[
  {
    "no": "1",
    "projectName": "...",
    "courseCode": "...",
    "startDate": "2026-04-01",
    "endDate": "2026-04-03",
    "instructor": "...",
    "companyName": "...",
    "teamName": "..."
  }
]
```

`/integrated` 는 동일 구조에 한글 키(`프로젝트명`, `교육시작일` …)를 사용합니다. 프론트엔드가 한글 키를 기대하면 이쪽, 표준 JSON 프로토콜이면 camelcase 쪽을 씁니다.

## 3~8번 — 단일 페이지 파서

입력은 BRIS 의 각 상세 페이지 HTML, 출력은 그 페이지의 핵심 필드를 평탄화한 object.

### 예: `/v1/parse/dm`

```sh
curl -X POST http://localhost:8000/v1/parse/dm \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html
```

응답 필드 일부:
```json
{
  "customerId": "CUST001",
  "company": "...",
  "companyGrade": "A",
  "name": "...",
  "position": "...",
  "department": "...",
  "phone": "02-123-4567",
  "mobile": "010-1234-5678",
  "email": "hong@example.com",
  "dmSubscription": "...",
  "customerLevel": "VIP"
}
```

### 각 kind 의 실제 응답 형태 확인법

응답 필드는 파서 구현과 동일합니다. 최신·정확한 필드 리스트는 세 가지 방법 중 선택:

1. **Swagger UI** — `http://localhost:8000/docs` 에서 각 엔드포인트 "Schemas" 섹션 (응답 타입이 `object` 로 되어 있다면 ②·③)
2. **픽스처의 expected JSON** — `lib/bris-parser/test/fixtures/<kind>.expected.json` — 실제 필드 골든
3. **실제 호출** — 위 curl 예시처럼 fixture 로 한 번 호출

## 입력 방식 — raw vs JSON

| 시나리오 | 권장 |
|----------|------|
| 대용량 HTML (>1MB), 스트림 업로드 | `Content-Type: text/html` + `--data-binary @file.html` |
| 다른 메타데이터를 함께 전달하고 싶음 | `Content-Type: application/json` + `{"html":"<html>..."}` |
| 브라우저 `fetch` 에서 HTML 문자열 보낼 때 | JSON 방식 (이스케이프 단순) |

JSON 사용 예:
```sh
curl -X POST http://localhost:8000/v1/parse/edu-detail \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"html": "<html>...</html>"}'
```

JSON 모드에서 `html` 필드 누락 시 → **`422 JSON body must contain \"html\" field`**.

## 파싱 실패 응답

파서가 예외를 던지면 **`400 Parse failed: <ExceptionName>: <message>`** 로 변환됩니다.

대표 원인:
- **입력이 BRIS 페이지가 아닌 다른 HTML** — 파서가 기대하는 테이블/셀렉터가 없음
- **BRIS 가 마크업을 변경** — 공통 픽스처(`lib/bris-parser/test/fixtures/`) 를 갱신하고 JS·Python 파서 양쪽 회귀 필요. 자세한 건 [`08-troubleshooting.md`](./08-troubleshooting.md)
- **문자 인코딩 깨짐** — BRIS 원본이 cp949 인 경우 `--data-binary` 그대로 전송(서버에서 `utf-8` 로 decode → replace). 깨진 값이 많으면 클라이언트 측 변환을 권장

## 다음

- 파싱 결과를 DB 에도 넣고 싶다 → [`04-endpoints-sync.md`](./04-endpoints-sync.md)
- 다른 언어에서 호출 → [`06-client-examples.md`](./06-client-examples.md)
