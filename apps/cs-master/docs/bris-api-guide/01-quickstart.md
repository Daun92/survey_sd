# 01. 퀵스타트 — 5분 안에 첫 호출 성공

이 문서를 끝내면:
- 컨테이너가 `healthy` 상태로 기동됨
- `GET /v1/health` 에서 200 응답 수신
- `POST /v1/parse/dm` 에서 JSON 응답 수신

---

## 0. 전제

| 요건 | 확인 방법 |
|------|-----------|
| Docker Desktop 기동 | `docker info` → Server 섹션 출력 |
| 작업 디렉터리 | `C:\Users\EXC\Downloads\cs\target` |
| 이미지 빌드 완료 | `docker images bris-api-server:0.1.0` 에 행 존재 |

이미지가 아직 없다면 먼저 [`../phase4-deployment.md`](../phase4-deployment.md) 의 "기동" 절을 따라 빌드하세요.

## 1. `.env` 준비

프로젝트 루트에 `.env` 가 없으면 템플릿에서 복사:

```sh
cp .env.example .env
```

**필수로 채울 값 한 개**:

```bash
BRIS_API_KEY=<랜덤 문자열 32자 이상 권장>
```

> **주의**: `BRIS_API_KEY` 를 비워두면 parse/sync 전부 **500** 을 반환합니다. health 와 `/` 만 통과합니다 — 이런 응답이 보이면 키가 비어 있다고 의심하세요.

Sync 엔드포인트도 쓸 예정이면 `BRIS_USER_ID/PASSWORD` (또는 `BRIS_COOKIE_FILE`) 와 `SUPABASE_URL/SERVICE_KEY` 도 채우세요.

## 2. 컨테이너 기동

```sh
docker compose up -d
```

기동 후 약 10초간 `health: starting` → `healthy` 로 전이됩니다.

```sh
docker compose ps
# STATUS 열에 "Up N seconds (healthy)" 가 뜨면 OK
```

## 3. 첫 호출 — Health

```sh
curl http://localhost:8000/v1/health
# 기대 응답: {"status":"ok","version":"0.1.0"}
```

인증 불필요, 항상 열려 있음.

## 4. 두 번째 호출 — Parse

저장소에 포함된 테스트 픽스처(DM 페이지 샘플) 로 파싱 호출:

```sh
API_KEY=$(grep "^BRIS_API_KEY=" .env | cut -d= -f2-)

curl -X POST http://localhost:8000/v1/parse/dm \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html
```

**기대 응답 (일부)**:
```json
{
  "customerId": "CUST001",
  "company": "...",
  "companyGrade": "A",
  "name": "...",
  "position": "...",
  "phone": "02-123-4567",
  "mobile": "010-1234-5678",
  "email": "hong@example.com",
  "dmSubscription": "...",
  "customerLevel": "VIP"
}
```

## 5. Swagger UI 로 탐색

브라우저에서 `http://localhost:8000/docs` 접속 → 모든 엔드포인트가 OpenAPI 스펙으로 문서화되어 있습니다. "Try it out" 버튼으로 직접 호출도 가능.

## 6. 다음 단계

- **다른 parse 종류 호출** → [`03-endpoints-parse.md`](./03-endpoints-parse.md)
- **BRIS→Supabase 동기화** → [`04-endpoints-sync.md`](./04-endpoints-sync.md)
- **다른 언어(Python/JS) 클라이언트** → [`06-client-examples.md`](./06-client-examples.md)
- **에러 응답이 왔다** → [`05-error-codes.md`](./05-error-codes.md)

## 체크리스트

- [ ] `.env` 에 `BRIS_API_KEY` 값이 들어감
- [ ] `docker compose ps` 가 `healthy` 표시
- [ ] `curl /v1/health` → 200
- [ ] `curl POST /v1/parse/dm` → 200 + JSON
- [ ] `http://localhost:8000/docs` 브라우저 열림
