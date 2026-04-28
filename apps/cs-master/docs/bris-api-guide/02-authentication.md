# 02. 인증 — X-API-Key

## 한 줄 요약

요청 헤더 `X-API-Key: <값>` 이 서버 환경변수 `BRIS_API_KEY` 와 **문자열 완전 일치**해야 통과.

## 어떤 엔드포인트가 인증을 요구하나?

| 경로 | 인증 |
|------|------|
| `GET /` | ❌ 불필요 |
| `GET /v1/health` | ❌ 불필요 |
| `GET /docs`, `/openapi.json` | ❌ 불필요 |
| `POST /v1/parse/*` (8종) | ✅ 필요 |
| `POST /v1/sync`, `/v1/sync/from-html` | ✅ 필요 |

## 설정 흐름

```
.env 에 BRIS_API_KEY=<키> 기록
   ↓
docker compose up -d   ← restart 아님!
   ↓
컨테이너가 env 에 BRIS_API_KEY 를 가진 채로 기동
   ↓
클라이언트가 X-API-Key 헤더로 동일 값 전송
   ↓
인증 통과 → 비즈니스 로직 실행
```

> **`.env` 수정 후에는 반드시 `docker compose up -d` (restart 금지)**. restart 는 기존 컨테이너의 env 를 그대로 재사용합니다. 자세한 이유: [`07-operations.md`](./07-operations.md#재시작-패턴) 참조.

## 응답 코드로 상태 진단

| 받은 응답 | 의미 | 조치 |
|-----------|------|------|
| `500 BRIS_API_KEY env not configured on server` | 서버 env 자체가 비어있음 | `.env` 확인 → `docker compose up -d` |
| `401 Invalid or missing X-API-Key header` | 서버는 키 있음, 클라이언트 헤더 틀림/누락 | 클라이언트 쪽 헤더 확인 |
| `200 OK` | 정상 | — |

## 키 생성 방법 (권장)

랜덤 32자 이상, URL-safe 문자만 사용:

```sh
# Linux/Mac/Git Bash
python -c "import secrets; print(secrets.token_urlsafe(32))"

# PowerShell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

출력 예시: `devk_guQY8pX2Tan9RmA5xncslY0E-pY6Ax5K`

## 키 교체 절차 (무중단 배포 아님)

```sh
# 1) 새 키 생성
NEW_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")

# 2) .env 수정
sed -i "s/^BRIS_API_KEY=.*/BRIS_API_KEY=$NEW_KEY/" .env

# 3) 컨테이너 재생성 (중요: restart 아님)
docker compose up -d

# 4) 호출 검증
curl -s -X POST http://localhost:8000/v1/parse/dm \
  -H "X-API-Key: $NEW_KEY" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html \
  -o /dev/null -w "%{http_code}\n"
# 200 이면 교체 성공

# 5) 기존 클라이언트에 새 키 배포
```

**주의**: 3단계 이후부터 구 키로 오는 요청은 모두 401. 클라이언트 전환이 완료될 때까지는 이 창이 존재합니다. 무중단이 필요하면 Phase 5(리버스 프록시 + 복수 키) 구조가 필요합니다.

## 보안 팁

- `.env` 는 절대 커밋 금지 (`.gitignore` 에 등록돼 있음)
- 키는 로그에 **원문으로 남기지 않음** — `curl -v` 로그, 앱 로그 확인
- 컨테이너 내부 확인: `docker compose exec bris-api env | grep BRIS_API_KEY` (셸 히스토리에 남으니 트러블슈팅 용도로만)
- CI/프록시 설정에 하드코딩 금지 — secret manager 또는 env 주입 사용
