# Phase 4 — BRIS API Server 배포

> **호출·운영 전반의 활용 가이드**: [`bris-api-guide/`](./bris-api-guide/README.md)
> 이 문서는 Docker 배포(빌드/기동/중지) 관점에만 집중합니다.

## 사전 준비

1. Docker Desktop (Windows/Mac) 또는 Docker Engine + Compose (Linux)
2. `.env.example` → `.env` 복사 후 값 채움
3. BRIS 쿠키 로그인 방식 사용 시:
   - 브라우저에서 BRIS 로그인 → DevTools 쿠키 복사 → `secrets/bris_cookies.json` 저장

## 기동

```sh
# 이미지 빌드 + 컨테이너 기동
docker compose up -d --build

# 로그 확인
docker compose logs -f bris-api

# 상태 확인
docker compose ps
curl http://localhost:8000/v1/health
```

## Swagger UI

`http://localhost:8000/docs`

## 환경변수 변경 시

`.env` 의 값이 바뀐 경우 **컨테이너를 재생성**해야 반영됩니다. `restart` 는 기존 컨테이너 env 를 그대로 재사용하므로 새 값이 들어가지 않습니다.

```sh
vi .env
docker compose up -d   # 설정 해시 변경 감지 → 컨테이너 재생성
```

> `docker compose restart bris-api` 는 **사용 금지** — `env_file` 변경이 반영되지 않습니다.

## 중지 / 제거

```sh
docker compose down                  # 컨테이너 중지 + 제거
docker compose down -v --rmi local   # 볼륨 + 이미지까지 제거
```

## Smoke 테스트

```sh
# 1. health
curl http://localhost:8000/v1/health
# → {"status":"ok","version":"0.1.0"}

# 2. 루트 메타 (파서 목록)
curl http://localhost:8000/
# → {"name":"bris-api-server", ...}

# 3. /v1/parse/dm (인증 필요)
curl -X POST http://localhost:8000/v1/parse/dm \
  -H "X-API-Key: $(grep BRIS_API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html
```

## 트러블슈팅

### HEALTHCHECK 실패

```sh
docker compose exec bris-api \
  python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/v1/health').read())"
docker compose logs bris-api | tail -40
```

### BRIS 인증 실패

- `BRIS_COOKIE_FILE` 경로 확인: 컨테이너 내부는 `/secrets/bris_cookies.json`
- 쿠키 파일 권한: 호스트 `secrets/` 는 read-only mount 됨
- 쿠키 만료 시 재로그인 후 덮어쓰기 → `docker compose restart`

### 포트 충돌

`.env` 에 `HOST_PORT=8001` 설정 후 `docker compose up -d --build`

### Windows에서 make 미설치

`Makefile` 대신 직접 `docker compose ...` 실행:

```sh
docker compose build
docker compose up -d
docker compose logs -f
docker compose down
```

## 이미지 정보

- 베이스: `python:3.13-slim`
- 태그: `bris-api-server:0.1.0`
- 목표 크기: ~250 MB 이하
- 포트: 컨테이너 8000 / 호스트 `HOST_PORT` (기본 8000)
- 실행 사용자: `appuser` (UID 1000)

## Phase 5 후보 (범위 밖)

- GitHub Actions CI (이미지 빌드 + pytest)
- Multi-arch build (ARM64 지원)
- Reverse proxy (nginx/Caddy + TLS)
- Rate limiting + Prometheus metrics
- 이미지 레지스트리 푸시 (사내 Harbor/GHCR)
- SBOM / Trivy 보안 스캔
