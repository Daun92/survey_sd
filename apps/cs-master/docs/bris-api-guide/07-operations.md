# 07. 운영 작업

일상 운영에서 반복되는 작업들. 전체 배포 절차는 [`../phase4-deployment.md`](../phase4-deployment.md) 참조.

## 상태 확인 체크리스트 (매일 아침)

```sh
cd C:/Users/EXC/Downloads/cs/target

# 1) 컨테이너 healthy?
docker compose ps
# STATUS 에 "Up ... (healthy)" 기대

# 2) 최근 에러 있는지?
docker compose logs --tail 50 bris-api | grep -iE "error|exception|traceback" || echo "(깨끗함)"

# 3) 외부에서 닿는지?
curl -sf http://localhost:8000/v1/health || echo "❌ health 실패"
```

## 로그 확인

```sh
# 실시간 스트림
docker compose logs -f bris-api

# 최근 N 줄
docker compose logs --tail 200 bris-api

# 특정 시각 이후
docker compose logs --since 2026-04-15T09:00:00 bris-api

# 에러만 빠르게
docker compose logs --tail 500 bris-api | grep -iE "500|error|exception|traceback"
```

uvicorn 기본 포맷: `INFO: <client> - "<method> <path> HTTP/1.1" <status> <reason>`. 500 만 빨리 찾고 싶다면:

```sh
docker compose logs --tail 1000 bris-api | grep " 500 "
```

## 재시작 패턴

| 상황 | 명령 | 비고 |
|------|------|------|
| 코드/이미지 변경 없음, 일시적 hang | `docker compose restart bris-api` | 기존 컨테이너 재시작 (env 그대로) |
| `.env` 수정 | **`docker compose up -d`** | 설정 해시가 바뀌면 재생성 |
| Dockerfile 수정 | `docker compose up -d --build` | 이미지 재빌드 후 재생성 |
| 완전 초기화 | `docker compose down && docker compose up -d` | 볼륨 유지 |
| 볼륨까지 초기화 | `docker compose down -v` | `secrets/` 마운트는 호스트 디렉터리라 남음 |

> **`.env` 수정 후 `restart` 는 변경이 반영되지 않습니다.** env_file 은 컨테이너 생성 시점에만 읽힙니다. 반드시 `up -d` 로 재생성.

## 이미지 재빌드

```sh
# 캐시 사용 (빠름)
docker compose build

# 캐시 무시 (의존성 완전 갱신)
docker compose build --no-cache

# 빌드 후 바로 기동
docker compose up -d --build
```

빌드 후 이미지 크기 확인:
```sh
docker images bris-api-server:0.1.0
# SIZE 열이 갑자기 커졌다면 .dockerignore 확인
```

## 컨테이너 내부 접속

```sh
# shell
docker compose exec bris-api bash

# 원샷 명령
docker compose exec bris-api python -c "import bris_api_server; print(bris_api_server.__version__)"

# env 확인 (민감정보 주의)
docker compose exec bris-api env | grep -E "^(BRIS|SUPABASE)_"
```

## 리소스 모니터링

```sh
# CPU/MEM 실시간
docker stats bris-api

# 한 줄 스냅샷
docker stats --no-stream bris-api
```

현재 제한: **MEM 512 MB / CPU 1.0**. 초과 시 응답 지연 → 제한 조정은 `docker-compose.yml` 의 `deploy.resources.limits` 수정 후 `up -d`.

## 백업 — 무엇을 백업하나?

이 컨테이너는 **상태 없는 게이트웨이** 입니다. 실제 데이터는 Supabase 에 저장되므로 **컨테이너 자체 백업은 불필요**합니다. 대신 다음을 백업:

| 자산 | 주기 | 위치 |
|------|------|------|
| `.env` | 변경 시 | 암호화된 secret store (예: Vault, 1Password) |
| `secrets/bris_cookies.json` | 갱신 시 | 동일 |
| `lib/bris-parser/test/fixtures/*.html/*.expected.json` | git commit 마다 | Git |
| Supabase DB | Supabase 대시보드의 PITR | Supabase |

## 포트 변경

기본 8000 → 다른 포트 (예 9000):

```sh
# 1. .env 에 추가
echo "HOST_PORT=9000" >> .env

# 2. 재생성
docker compose up -d

# 3. 검증
curl http://localhost:9000/v1/health
```

컨테이너 내부 포트는 항상 8000 — 외부 접근 포트만 바뀝니다.

## 업그레이드 절차

```sh
# 1. 현재 버전 기록
docker images bris-api-server --format "{{.Tag}} {{.CreatedAt}}"

# 2. 태그 고정 (롤백 대비)
docker tag bris-api-server:0.1.0 bris-api-server:rollback-$(date +%Y%m%d)

# 3. 코드 업데이트 (git pull 등)

# 4. 재빌드 + 기동
docker compose up -d --build

# 5. smoke
curl -sf http://localhost:8000/v1/health
curl -sf -X POST http://localhost:8000/v1/parse/dm \
  -H "X-API-Key: $(grep '^BRIS_API_KEY=' .env | cut -d= -f2-)" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html \
  -o /dev/null -w "%{http_code}\n"
# 200 이면 업그레이드 성공

# 6. 롤백 필요 시
docker tag bris-api-server:rollback-YYYYMMDD bris-api-server:0.1.0
docker compose up -d
```

## 모니터링 (현재 수준)

| 항목 | 수단 |
|------|------|
| Liveness | Docker HEALTHCHECK (30s 주기 / `/v1/health`) |
| Status | `docker compose ps` |
| 응답 시간 | (없음) — 필요 시 Phase 5 에서 prometheus-fastapi-instrumentator |
| 에러율 | 로그 수동 grep — 필요 시 Phase 5 |
| 알림 | (없음) — HEALTHCHECK 실패 시 재시작만 |

구조화 모니터링이 필요해지면 Phase 5 범위 — 설계 계획의 "11. 범위 밖" 참고.

## 다음

- 장애 증상별 대응 → [`08-troubleshooting.md`](./08-troubleshooting.md)
- 에러 응답 해석 → [`05-error-codes.md`](./05-error-codes.md)
