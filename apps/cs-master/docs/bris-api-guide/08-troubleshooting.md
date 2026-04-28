# 08. 문제 해결 (FAQ)

증상 → 원인 → 해결 순으로 정리. 왼쪽에서 본인 증상과 가장 가까운 것을 찾으세요.

---

## 1. 컨테이너가 시작 안 됨 / 바로 죽음

### 1-A. `Container bris-api Started` 후 몇 초 만에 `Exited`

```sh
docker compose logs --tail 50 bris-api
```

- `ModuleNotFoundError: No module named 'bris_parser'` → 이미지 빌드 시 `pip install -e lib/bris-parser-py` 가 실패. `docker compose build --no-cache` 로 재빌드
- `ImportError: cannot import name 'extract_...'` → Python 파서 패키지 버전 불일치. 로컬 `git pull` 후 재빌드
- `address already in use` → 8000 포트 충돌. `.env` 에 `HOST_PORT=<다른 번호>` 추가 후 `docker compose up -d`

### 1-B. `health: starting` 에서 `unhealthy` 로 전환

10초 뒤에도 `starting` 이면 uvicorn 이 뜨지 않은 것. 로그 확인:
```sh
docker compose logs --tail 30 bris-api | grep -i "Application startup\|Uvicorn"
```
- `Application startup complete` 가 안 보이면 시작 예외 있음 → 위 로그 스캔
- `Uvicorn running on http://0.0.0.0:8000` 이 찍혀도 unhealthy 면 → 컨테이너 내 `curl localhost:8000/v1/health` 테스트

---

## 2. `500 BRIS_API_KEY env not configured on server`

**가장 자주 나오는 증상.** `/v1/health` 는 OK 인데 parse/sync 는 500.

**원인**: 컨테이너 env 에 `BRIS_API_KEY` 가 없음. 세 가지 경로 중 하나:

| 경로 | 확인법 |
|------|--------|
| `.env` 에 키 자체가 없음 | `grep '^BRIS_API_KEY=' .env` |
| `.env` 에 키는 있지만 컨테이너가 모름 | `docker compose exec bris-api sh -c 'echo has: $([ -n "$BRIS_API_KEY" ] && echo YES || echo NO)'` |
| 키 값은 있는데 빈 문자열 | `docker compose exec bris-api sh -c 'echo "len=${#BRIS_API_KEY}"'` |

**해결**:
```sh
# .env 수정 후 반드시 재생성 (restart 아님)
docker compose up -d
```

---

## 3. `.env` 수정했는데 반영이 안 됨

**원인**: `docker compose restart` 를 쓰셨나요? `env_file` 은 **생성 시점**에만 읽힙니다.

**해결**:
```sh
docker compose up -d   # 설정 해시 변경 감지 → 컨테이너 재생성
```

내부 env 확인:
```sh
docker compose exec bris-api env | grep -E "^(BRIS|SUPABASE)_"
```

---

## 4. `401 Invalid or missing X-API-Key header`

서버 env 는 OK, 클라이언트 헤더 문제.

**체크리스트**:
- [ ] 헤더 이름: `X-API-Key` (표준은 대소문자 구분 없지만 오타 주의: `XApiKey`, `api_key` 등은 NO)
- [ ] 값 앞뒤 공백/개행 여부: `echo -n "$KEY" | xxd | tail -5`
- [ ] `.env` 의 값과 클라이언트가 사용하는 값이 정말 같은가 — 양쪽 길이(`wc -c`) 비교
- [ ] 최근 키 교체 후 구 키 캐시 여부 — 클라이언트 설정/CI secrets 갱신

---

## 5. Parse 가 `400 Parse failed: ...`

파서가 기대한 구조와 입력 HTML 이 다름.

### 5-A. 어떤 HTML 인지부터 확인
1. kind 가 맞나? (예: 프로젝트 세부 HTML 을 `/v1/parse/dm` 에 보내면 당연히 실패)
2. 픽스처로 재현되나?
   ```sh
   curl -X POST http://localhost:8000/v1/parse/<kind> \
     -H "X-API-Key: $KEY" -H "Content-Type: text/html" \
     --data-binary @lib/bris-parser/test/fixtures/<kind>.html
   ```
   → 이건 200 이어야 함. 200 이면 **서버 정상, 입력 HTML 이 문제**

### 5-B. BRIS 마크업이 바뀐 것 같다
징후: "며칠 전까진 됐는데 오늘부터 실패", "특정 월 데이터만 실패".

1. 실패하는 원본 HTML 을 `lib/bris-parser/test/fixtures/` 에 저장 (예: `dm_broken_20260415.html`)
2. 대조용 기존 fixture 와 `diff -u` — 구조 변화 지점 확인
3. 파서 개발자에 전달 → JS/Python 파서 둘 다 패치 → 기존 fixture 도 갱신 (BRIS 구조가 영구 변경된 경우)
4. 회귀: `npm test`, `cd lib/bris-parser-py && pytest`, `cd lib/bris-api && pytest`

---

## 6. Sync 가 BRIS 인증 실패

**메시지 예**: `Sync failed: HTTPError: 401 Unauthorized from BRIS`

**원인 & 해결**:

| 원인 | 해결 |
|------|------|
| 쿠키 만료 (`BRIS_COOKIE_FILE`) | 브라우저로 BRIS 재로그인 → 새 쿠키 `secrets/bris_cookies.json` 로 덮어쓰기 → `docker compose up -d` |
| `BRIS_USER_ID`/`PASSWORD` 오타 | `.env` 수정 → `up -d` |
| BRIS 가 IP 차단 중 | 방화벽/VPN 확인 — 컨테이너 내부에서 `curl -I https://bris.exc.co.kr` |
| BRIS 계정 자체 잠김 | 사내 관리자에게 확인 |

---

## 7. Sync 가 Supabase 에러

**메시지 예**: `Sync failed: APIError: JWT expired`, `... 401 Invalid API Key`

| 원인 | 해결 |
|------|------|
| `SUPABASE_SERVICE_KEY` 만료/재발급 | Supabase 대시보드 → Settings → API → service_role 키 복사 → `.env` 수정 → `up -d` |
| `SUPABASE_URL` 오타 (https 누락 등) | 형식: `https://<proj>.supabase.co` |
| RLS 위반 | service_role 키를 쓰고 있는지 확인 (anon 키로는 upsert 불가) |

---

## 8. 응답 인코딩이 깨짐

브라우저 / Windows 터미널에서 한글이 `ȫ�浿` 처럼 보임.

**원인**: 거의 항상 **표시하는 쪽** 문제. 서버는 UTF-8 JSON 을 반환함 (`Content-Type: application/json; charset=utf-8`).

**검증**:
```sh
# UTF-8 디코딩 강제
curl -s http://localhost:8000/v1/parse/dm \
  -H "X-API-Key: $KEY" -H "Content-Type: text/html" \
  --data-binary @lib/bris-parser/test/fixtures/dm.html \
  | python -m json.tool
# → 한글이 정상 출력되면 서버 OK
```

Git Bash on Windows 는 콘솔 인코딩이 cp949 인 경우가 많음 — `chcp 65001` 실행 후 재시도.

---

## 9. 포트 충돌

```
Error response from daemon: driver failed programming external connectivity on endpoint bris-api: ... bind: address already in use
```

**해결**:
```sh
# 8000 을 쓰는 프로세스 확인
netstat -ano | findstr :8000           # Windows
lsof -i :8000                           # Mac/Linux

# 다른 포트로 바꾸기
echo "HOST_PORT=9000" >> .env
docker compose up -d
curl http://localhost:9000/v1/health
```

---

## 10. 이미지 크기가 비정상적으로 크다

`docker images bris-api-server:0.1.0` 이 700 MB+ 를 보임.

**원인**: `.dockerignore` 가 제대로 동작하지 않았거나, `lib/bris-parser/node_modules/` 같은 디렉터리가 컨텍스트에 포함됨.

**확인**:
```sh
# 빌드 컨텍스트 크기
du -sh .
# 수백 MB 가 나오면 .dockerignore 체크

# 이미지 레이어별 분석
docker history bris-api-server:0.1.0
```

**해결**: `.dockerignore` 에 대용량 디렉터리 추가 후 재빌드.

---

## 11. `docs/docs` 가 브라우저에서 404

Swagger UI 경로는 `/docs` 입니다 (`/docs/` 아님, `/v1/docs` 아님). `http://localhost:8000/docs` 로 접속하세요.

---

## 12. 회귀 테스트가 실패함

호스트에서 `pytest` 실행 시:

```sh
cd lib/bris-parser-py && python -m pytest    # 19 테스트
cd lib/bris-api       && python -m pytest    # 21 테스트
cd lib/bris-parser    && npm test            # 14 테스트
```

- `ModuleNotFoundError` → `pip install -e lib/bris-parser-py lib/bris-api[dev]` 재실행
- `fixture file not found` → 작업 디렉터리 문제 — pytest 는 패키지 루트(`lib/bris-api` 등) 에서 실행
- 한두 케이스만 실패 → BRIS 마크업 변경 가능성 ([5-B](#5-b-bris-마크업이-바뀐-것-같다))

---

## 에스컬레이션 기준

다음 중 하나면 단순 운영 범위를 넘어감 — 개발팀에 전달:

- 파서 코드 수정이 필요한 BRIS 마크업 변경
- Supabase 스키마 변경을 동반하는 sync 오류
- 성능 이슈 (응답 30초+ 지속)
- 인증 구조 변경 (복수 키, OAuth 등)
- Phase 5 범위 기능 요청 (CI, 모니터링, 레지스트리 등)

## 관련 문서

- [`05-error-codes.md`](./05-error-codes.md) — HTTP 코드별 해석
- [`07-operations.md`](./07-operations.md) — 로그 / 재시작 / 모니터링
- [`../phase4-deployment.md`](../phase4-deployment.md) — Docker 배포 전체
