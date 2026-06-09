# 종합 허브 · 퍼블리시 · 업로드 프로세스 (22회)

> 매일 자동 갱신되는 3종(수집현황 대시보드 · 세그먼트별 요약 · 최종 덱)을 종합 허브로 묶어
> `apps.exc.co.kr/staff/45/files/` 에 게시하고 지속 관리하기 위한 디렉토리·프로세스 정의.
> 작성 2026-06-01.

## 1. 결정 사항 (분석가 확정)
- **업로드 방식**: apps.exc.co.kr Django 로그인+CSRF → `POST /staff/45/files/upload/` (가이드 `../apps-upload-guide.md`).
- **접근 통제**: 스태프 로그인 전용(내부) → 대시보드의 회사명·AM명 PII **그대로 게시 OK**. (개별 응답자 리포트는 PII 전량이라 게시 대상 **제외**.)
- **보존**: 매일 덮어쓰기(최신만). 일자 아카이브 없음.

## 2. 디렉토리 구조 (로컬 ↔ 원격 1:1 미러)
```
로컬  D:\…\22회_2026\5_report\publish\        원격  https://apps.exc.co.kr/staff/45/files/hrd22/
  index.html       (종합 허브, 공유 URL)   →     index.html
  dashboard.html   (수집현황 대시보드)      →     dashboard.html
  segment.html     (세그먼트별 요약)        →     segment.html
  deck.html        (최종 발표 덱)           →     deck.html
```
- **공유 URL(허브)** = `https://apps.exc.co.kr/staff/45/preview/hrd22/index.html`
  (업로드는 `/staff/45/files/upload/` path=`hrd22/`; 서빙은 정적 경로가 아니라 **`/preview/` 뷰어** 경유 — 2026-06-01 확인. 스태프 로그인 후 렌더.)
- 허브 링크는 **상대경로**(`./dashboard.html` …) → preview 경로에서 `preview/hrd22/dashboard.html` 로 정상 해석(카드 클릭 이동 동작). 전용 하위폴더 `hrd22/` 로 다른 파일과 분리.
- 원본은 `5_report/preview/`(날짜고정 파일명, 매일 덮어쓰기); 퍼블리시 단계가 **최신본을 안정적 이름으로 복사**.
- **자기완결(중요)**: 4종 모두 **CSS 인라인**. segment·deck 의 ECharts 는 CDN(jsdelivr) 대신 **로컬 `assets/echarts.min.js`(5.5.0, ~1MB) 를 업로드본에 인라인** → 사내망 CDN 차단에도 차트 렌더(로컬 preview 는 CDN 유지·가벼움). 외부 `<link>`·`<script src>` 의존 0. `assets/echarts.min.js` 없으면 CDN 유지(경고).

## 3. 일일 프로세스 (07:00 자동)
```
Windows 작업 스케줄러 'HRD22_daily' 07:00
  └ daily_update.ps1 → run_pipeline.py
       fetch_raw → validate → deck·result·segment·outliers·dashboard
       → hub(stage6_render_hub: publish/ 4종 생성)
       → upload(upload_apps.py: publish/ → 원격 hrd22/)   ※ 비치명
```
- **hub 단계**: 최신 3종을 `publish/` 에 stable 이름으로 복사 + 허브 재생성.
- **upload 단계(비치명)**: 자격증명 있으면 업로드, 없으면 건너뜀, 실패해도 파이프라인 중단 안 함(로컬 산출물은 유효).
- 로그: `logs/pipeline_*.log`.

## 4. 활성화 (최초 1회 — 분석가 작업)
1. `creds/apps_creds.txt.example` 를 복사해 `creds/apps_creds.txt` 생성, `APPS_ID`/`APPS_PW` 입력.
   (비밀번호 평문 → 외부 공유·백업 금지, 이 PC 로컬에만.)
2. 로그인 확인:  `python scripts/upload_apps.py --dry-run`  → "로그인 성공" 이어야 함.
3. 업로드 테스트: `python scripts/upload_apps.py`  → publish/ 4종 업로드.
   공유 URL(허브): `https://apps.exc.co.kr/staff/45/preview/hrd22/index.html`
4. 이후 매일 자동 업로드(별도 조치 불필요).

> **활성화·검증 완료(2026-06-01)**: 로그인 성공·4종 업로드 성공·preview 렌더 확인. 자격증명은 프로젝트
> `creds/apps_creds.txt`(또는 상위 `07.HR실태조사/creds/`)에서 자동 탐색.

## 5. 스크립트
| 파일 | 역할 |
|---|---|
| `scripts/stage6_render_hub.py` | 종합 허브 생성 + publish/ 묶음(최신 3종 stable 복사) |
| `scripts/upload_apps.py` | apps.exc.co.kr 로그인+업로드(requests, 세션·CSRF). `--dry-run`/`--path` |
| `scripts/run_pipeline.py` | 오케스트레이터(…→hub→upload). `--no-upload` 로 업로드만 생략 |

## 6. 검증 상태 (2026-06-01)
- **가이드 정정**: 이 서버 실제 경로는 `/auth/login/`(가이드 `/login/`은 404), 로그인 필드 `user_id`(가이드 `username` 아님). upload_apps.py 에 반영.
- **로그인 메커니즘 검증됨**: GET `/auth/login/` 200·CSRF 토큰 추출 OK, 가짜 자격증명 POST → **401**(자격증명 오류, CSRF/엔드포인트/필드는 정상). 실 자격증명만 채우면 로그인 성공 예상.
- **미검증(첫 실행 시 확인)**: 인증 후 업로드 POST `/staff/45/files/upload/` 응답. 가이드의 서비스36 동일 앱 기준이라 유효 추정 — `upload_apps.py` 가 응답을 로그로 출력하니 첫 실행에서 확인. 실패 시 Playwright(가이드 JS)로 전환 가능.
- **하위폴더 생성**: `path=hrd22/` 가 자동 생성되지 않으면 포털에서 `hrd22` 1회 생성 후 재시도(또는 `--path ""` 루트 — 파일명 충돌 주의).
- **PII**: 내부(스태프 로그인) 전제. 공개 전환 시 대시보드 회사명·AM명 마스킹 재검토.

## 7. 운영 명령
```bash
# 수동 전체 재생성+업로드
python scripts/run_pipeline.py --no-fetch
# 업로드만 (publish/ 이미 최신일 때)
python scripts/upload_apps.py
# 업로드 제외하고 재생성만
python scripts/run_pipeline.py --no-upload
```
