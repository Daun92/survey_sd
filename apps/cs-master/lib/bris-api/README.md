# bris-api-server

BRIS HTML 파서 + Supabase 동기화 REST API 게이트웨이.

> **운영자용 활용 가이드**: [`docs/bris-api-guide/`](../../docs/bris-api-guide/README.md) — 퀵스타트·인증·엔드포인트·에러코드·클라이언트 샘플·운영/FAQ 수록
> **Docker 배포**: [`docs/phase4-deployment.md`](../../docs/phase4-deployment.md)


## 엔드포인트

### 메타 (인증 불필요)
- `GET /` — 서비스 정보
- `GET /v1/health` — 헬스체크
- `GET /docs` — Swagger UI
- `GET /openapi.json` — OpenAPI 스펙

### 파서 (인증 필수, 8종)
| Path | 입력 | 출력 |
|------|------|------|
| `POST /v1/parse/integrated` | BRIS HTML | 한글 키 records |
| `POST /v1/parse/integrated/camelcase` | BRIS HTML | camelCase records |
| `POST /v1/parse/edu-detail` | BRIS HTML | object |
| `POST /v1/parse/echo-view` | BRIS HTML | object |
| `POST /v1/parse/echo-data` | BRIS HTML | object (with schedules) |
| `POST /v1/parse/project-detail` | BRIS HTML | object |
| `POST /v1/parse/project-biz` | BRIS HTML | sessions[] |
| `POST /v1/parse/dm` | BRIS HTML | object |

요청 바디: `Content-Type: text/html` 일 경우 raw HTML, `application/json` 일 경우 `{"html": "..."}`.

### Sync (인증 필수)
- `POST /v1/sync` — `{startDate, endDate, autoBatch?}` → BRIS fetch + Supabase upsert
- `POST /v1/sync/from-html` — `{html, periodStart?, periodEnd?, autoBatch?}` → 로컬 HTML 동기화

## 인증

모든 `/v1/parse/*`, `/v1/sync*` 엔드포인트는 `X-API-Key` 헤더가 환경변수 `BRIS_API_KEY`와 일치해야 함.

## 환경변수

| 변수 | 필수 시점 | 설명 |
|------|---------|------|
| `BRIS_API_KEY` | parse/sync | API 인증 키 |
| `BRIS_USER_ID` / `BRIS_PASSWORD` | sync | BRIS 로그인 (또는 BRIS_COOKIE_FILE) |
| `BRIS_COOKIE_FILE` | sync (대체) | BRIS 쿠키 JSON 파일 경로 |
| `SUPABASE_URL` | sync | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | sync | Supabase service_role 키 |

## 설치 + 실행

```sh
pip install -e .[dev]
export BRIS_API_KEY=local-test
uvicorn bris_api_server:app --port 8000
# http://localhost:8000/docs → Swagger UI
```

Sync 엔드포인트도 사용하려면:
```sh
pip install -e .[dev,sync]
export BRIS_USER_ID=...
export BRIS_PASSWORD=...
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_SERVICE_KEY=...
```

## 사용 예시 (curl)

```sh
# Parse (raw HTML)
curl -X POST http://localhost:8000/v1/parse/dm \
  -H 'X-API-Key: local-test' \
  -H 'Content-Type: text/html' \
  --data-binary @../bris-parser/test/fixtures/dm.html

# Parse (JSON)
curl -X POST http://localhost:8000/v1/parse/edu-detail \
  -H 'X-API-Key: local-test' \
  -H 'Content-Type: application/json' \
  -d '{"html": "<html>...</html>"}'

# Sync
curl -X POST http://localhost:8000/v1/sync \
  -H 'X-API-Key: local-test' \
  -H 'Content-Type: application/json' \
  -d '{"startDate": "2026-04-01", "endDate": "2026-04-30"}'
```

## 테스트

```sh
python -m pytest -v
# meta(3) + parse(13) + sync(4) = 20 통과
```

테스트는 공통 픽스처(`../bris-parser/test/fixtures/`)를 그대로 사용 — 동일 골든이 JS/Python 파서/REST 모두에서 검증됨.

## 아키텍처

```
HTTP 요청
   ↓
FastAPI app
   ├── routers/meta.py     ← /, /v1/health
   ├── routers/parse.py    ← /v1/parse/{kind} → bris_parser 함수
   └── routers/sync.py     ← /v1/sync → bris_to_supabase.BrisSyncPipeline
                                            └── BrisClient (BRIS HTTP)
                                            └── supabase-py (DB upsert)
```
