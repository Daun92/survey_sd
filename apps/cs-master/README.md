# cs-master

CS 사후설문 대상자 관리 시스템. BRIS 교육과정 데이터를 수집해 설문 발송 대상자를 선정·심사하는 운영 도구.

## 위치 / 배포

| 산출물 | 호스팅 | 배포 방법 |
|---|---|---|
| `index.html`, `cs_dashboard.html`, `default.asp`, `bris_proxy.asp` | onepage.exc.co.kr/cs_master/ (사내 IIS) | FTP 수동 |
| FastAPI BRIS gateway (`lib/bris-api/`) | 사내 Docker 호스트 | `docker compose up -d` |
| Sync 파이프라인 (`bris_to_supabase.py`) | 사내 Docker 또는 cron | Docker 컨테이너 또는 직접 실행 |

**중요**: cs-master 는 사내망 BRIS 시스템에 접근해야 하므로 **Vercel 호스팅 대상이 아님**. survey_sd 모노레포 안에 같이 들어 있는 이유는 DB SSOT(`supabase/migrations/`) 통합 및 코드 관리 일원화 목적.

## 데이터 흐름

```
BRIS (사내) ──[수동 HTML 붙여넣기 또는 lib/bris-api fetch]──→ 파서 ──→ Supabase Layer 0 (raw_pages/records, BRONZE)
                                                                              ↓
                                                                Layer 1 (cs_courses/projects/contacts, SILVER)
                                                                              ↓
                                                                Layer 2 (v_cs_* 뷰, GOLD)
                                                                              ↓
                                                                Layer 3 (cs_survey_targets step1~5 심사)
                                                                              ↓
                                                            cs_dashboard.html (운영자 UI) ──→ survey_sd 의 cs-bridge route
                                                                              ↓
                                                                    설문 발송 (email_queue/sms_queue)
```

DB SSOT: 본 모노레포 root 의 `supabase/migrations/`. 본 폴더의 `supabase/` 가 아님 (옵션 B, 2026-04-28 결정).

## 폴더 구조

| 경로 | 용도 |
|---|---|
| `index.html` | 운영자용 대상자 관리 SPA (~4900줄, localStorage 기반) |
| `cs_dashboard.html` | 발송 dispatch UI (Supabase 백엔드, cs-bridge 호출) |
| `default.asp`, `bris_proxy.asp` | IIS 사이드 BRIS 프록시 (`/default.asp?bris_proxy=`) |
| `bris_api.py` | BrisClient (BRIS 자동 fetch) + parser re-export |
| `bris_to_supabase.py` | BrisSyncPipeline (Layer 0/1 적재) |
| `bris_examples.py`, `bris_cron_runner.sh` | 운영 스크립트 |
| `lib/bris-parser/` | JS 파서 (IIFE/ESM/CJS, 8종 페이지) |
| `lib/bris-parser-py/` | Python 파서 (JS 와 동일 골든 사용) |
| `lib/bris-api/` | FastAPI 게이트웨이 (12 엔드포인트, X-API-Key) |
| `Dockerfile`, `docker-compose.yml`, `Makefile` | 사내 Docker 배포 |
| `docs/` | 운영/배포 문서 (phase4-deployment 등) |
| `data_model_v2.md`, `data_flow.md`, `api_reference.md` | 설계 문서 |
| `archive/` | 옛 버전/백업 (참고용) |

## 운영

### 로컬 실행

```bash
cd apps/cs-master
cp .env.example .env  # BRIS_API_KEY, SUPABASE_URL 등 채움
docker compose up -d
curl -H "X-API-Key: $BRIS_API_KEY" http://localhost:8000/v1/health
```

### 사내 배포

- HTML/ASP: FTP 로 `onepage.exc.co.kr/cs_master/` 에 업로드 (수동)
- FastAPI/sync: 사내 Docker 호스트에서 `docker compose pull && docker compose up -d`

자세한 절차는 `docs/phase4-deployment.md`.

## 의존 시스템

- **BRIS**: 사내 교육 관리 시스템. 직접 접근은 사내망 + 자격증명 필요.
- **Supabase 프로젝트 `gdwhbacuzhynvegkfoga`**: cs_* 테이블/뷰/RPC 호스팅. 마이그레이션은 모노레포 root 의 `supabase/migrations/`.
- **survey_sd web 앱 (Vercel)**: cs_dashboard 가 dispatch 시 `/api/distributions/cs-bridge` 호출.

## 보안 주의

- `secrets/bris_cookies.json` — BRIS 세션 쿠키. **절대 커밋 금지** (.gitignore 규칙).
- `.env` 의 `BRIS_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — **절대 커밋 금지**.
- 운영자가 사용하는 `*.xlsx`, `*.csv` 파일에는 학습자 개인정보(이름/연락처/이메일) 포함 — `.gitignore` 로 차단.

## 관련 메모리

- `project_factory_layer0.md` — 메달리온 4-layer 아키텍처
- `project_parser_phases.md` — Phase 1~4 인프라
- `project_monorepo_migration.md` — 본 폴더의 이전 배경
