# 05. HTTP 에러 코드 & 복구 절차

모든 에러 응답은 FastAPI 기본 포맷을 따릅니다:

```json
{ "detail": "<사람이 읽을 수 있는 메시지>" }
```

## 코드별 매트릭스

| HTTP | 발생 엔드포인트 | 대표 메시지 | 진단 |
|------|-----------------|------------|------|
| **200** | 전체 | - | 정상 |
| **400** | `/v1/parse/*` | `Parse failed: <ExcType>: <msg>` | 입력 HTML 이 파서 기대와 불일치 |
| **401** | parse/sync | `Invalid or missing X-API-Key header` | 클라이언트 헤더 오류 |
| **422** | `/v1/parse/*` (JSON 모드) | `JSON body must contain "html" field` | JSON 스키마 불일치 |
| **422** | `/v1/sync*` | pydantic 검증 메시지 | 필수 필드 누락/타입 오류 |
| **500** | parse/sync | `BRIS_API_KEY env not configured on server` | 서버 env 자체 비어있음 |
| **500** | `/v1/sync*` | `Sync failed: <ExcType>: <msg>` | BRIS/Supabase 외부 시스템 오류 |
| **502/503** | 전체 | (프록시/게이트웨이 응답) | 이 서버가 아닌 앞단 프록시 문제 |

## 400 — Parse 실패

**메시지 예**:
```
Parse failed: AttributeError: 'NoneType' object has no attribute 'find'
Parse failed: ValueError: no table.grid found
Parse failed: KeyError: 'projectCode'
```

**원인**:
1. 잘못된 페이지를 보낸 경우 (edu-detail 파서에 integrated 페이지 주입 등)
2. BRIS 마크업 변경 → 셀렉터 미스매치
3. HTML 인코딩/짤림

**복구**:
1. 어떤 페이지 HTML 인지 재확인 → 해당 kind 엔드포인트에 맞게 조정
2. 저장소의 픽스처로 테스트:
   ```sh
   curl -X POST http://localhost:8000/v1/parse/dm \
     -H "X-API-Key: $API_KEY" -H "Content-Type: text/html" \
     --data-binary @lib/bris-parser/test/fixtures/dm.html
   ```
   → 이게 200 이면 서버는 정상, 입력 HTML 이 문제
3. BRIS 마크업이 바뀐 것 같으면 → 파서 개발자에게 에스컬레이션 ([`08-troubleshooting.md`](./08-troubleshooting.md) "BRIS 마크업 변경" 섹션)

## 401 — 인증 실패

```json
{ "detail": "Invalid or missing X-API-Key header" }
```

| 원인 | 확인법 |
|------|--------|
| 헤더 이름 오타 (`x-api-key` 는 OK, `ApiKey` 는 NO) | `curl -v` 로 요청 헤더 확인 |
| 값 복사 중 공백/개행 혼입 | `echo -n "$API_KEY" \| wc -c` 로 길이 비교 |
| 서버와 클라이언트가 서로 다른 `.env` 값 참조 | `docker compose exec bris-api sh -c 'echo $BRIS_API_KEY \| wc -c'` 와 비교 |
| 키 교체 후 구 키로 호출 중 | 최신 `.env` 값 다시 배포 |

## 422 — 검증 실패

**Parse (JSON 모드)**:
```json
{ "detail": "JSON body must contain \"html\" field" }
```

**Sync (pydantic)**:
```json
{
  "detail": [
    {"loc": ["body", "startDate"], "msg": "field required", "type": "missing"}
  ]
}
```

**복구**: 요청 바디 스키마 확인 — [`03-endpoints-parse.md`](./03-endpoints-parse.md) / [`04-endpoints-sync.md`](./04-endpoints-sync.md) 표 참조.

## 500 — BRIS_API_KEY env 미설정

```json
{ "detail": "BRIS_API_KEY env not configured on server" }
```

> **파란불(health)은 뜨는데 parse 만 500** 이 오면 99% 이 경우입니다.

**복구 (30초)**:
```sh
# 1. 서버 env 확인
docker compose exec bris-api sh -c 'echo "has key: $([ -n "$BRIS_API_KEY" ] && echo YES || echo NO)"'

# 2. .env 수정
vi .env

# 3. 컨테이너 재생성 (restart 아님!)
docker compose up -d

# 4. 재확인
curl -X POST http://localhost:8000/v1/parse/dm \
  -H "X-API-Key: $(grep '^BRIS_API_KEY=' .env | cut -d= -f2-)" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html \
  -o /dev/null -w "%{http_code}\n"
# 200 → 정상화
```

## 500 — Sync 실패

```
Sync failed: ConnectionError: Failed to connect to BRIS
Sync failed: SupabaseError: 401 Unauthorized
Sync failed: ValueError: invalid date format
```

**진단 순서**:
1. 메시지의 예외 타입으로 외부 시스템 구분
   - `Connection*`, `Timeout*`, `HTTPError` → BRIS 측
   - `Supabase*`, `APIError` → Supabase 측
   - `ValueError`, `KeyError` → 입력/내부 로직
2. 컨테이너 로그 전체 traceback:
   ```sh
   docker compose logs --tail 200 bris-api
   ```
3. BRIS 이면 `BRIS_COOKIE_FILE` / `BRIS_USER_ID`+`PASSWORD` env 유효성 확인
4. Supabase 면 `SUPABASE_SERVICE_KEY` 만료/오타 확인 + 프로젝트 URL 호스트명 일치 확인

## 502 / 503 / 504 — 이 서버 아님

응답이 이 서버의 JSON 포맷이 아니라 HTML(nginx/Cloudflare 기본 페이지) 이면, 앞단 프록시/게이트웨이에서 에러가 난 것입니다. 이 서버는 현재 직접 노출(8000번)이므로 이 상황이 나오면:

- VPN/회사 프록시에서 차단
- 리버스 프록시가 별도 세팅되어 있다면 프록시 로그 확인
- 이 서버 자체는 멀쩡할 수 있으니 `curl http://127.0.0.1:8000/v1/health` 을 **서버 머신 위에서** 직접 시도

## 복구 의사결정 트리

```
응답 JSON 인가?
├── NO → 앞단 프록시/네트워크 문제
└── YES → detail 확인
    ├── "BRIS_API_KEY env not configured" → 02 문서 / 서버 env 수정
    ├── "Invalid or missing X-API-Key"    → 02 문서 / 클라이언트 헤더 수정
    ├── "JSON body must contain ..."      → 03 문서 / 바디 스키마 재확인
    ├── "Parse failed: ..."                → 08 문서 / 입력 HTML 재검토
    ├── "Sync failed: ..."                 → 04+08 문서 / 외부 시스템 점검
    └── pydantic loc/msg 배열               → 필드 검증 오류 / 요청 스키마 비교
```

## 다음

- 자주 나오는 증상 → [`08-troubleshooting.md`](./08-troubleshooting.md)
- 로그 수집 방법 → [`07-operations.md`](./07-operations.md)
