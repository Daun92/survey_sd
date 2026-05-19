# PR title

feat(cs-master): 단건 PROJECT_ID 풀 컨텍스트 백필 (T2 트랙)

# PR body (Draft 권장)

## Summary

T2 트랙 — BRIS 통합페이지에 노출되지 않는 단건 PROJECT_ID (원격교육 등) 풀 컨텍스트 백필 파이프라인.

- `BrisClient` 에 4페이지 fetcher 신설: `project_view`, `project_biz_list` (successCode 동반 필수), `dm_view`, `echo_operate (project_id 소문자 파라미터)`. 정상 페이지/세션 만료 false-positive 방지 `_check_session_html` 동봉.
- `BrisSyncPipeline.refresh_project_id(project_id)` — 7단계 파이프라인 (sync_start → project_view → biz_list → echo → dm → 통합 record 변환 → `_sync_project_group` 재사용 → sessions=0 시 빈 cs_courses 정리 → sync_finish). Layer 0 적재 + best-effort 분기.
- 세션 만료 시 `BRIS_USER_ID/BRIS_PASSWORD` 로 1회 자동 재로그인 + retry.
- AM 셀 `정용호 경기팀`/`정용호경기팀` → `(am, amTeam)` 분리 (수주팀 vs 수행팀 보존).
- CLI: `python bris_to_supabase.py project-id <BRIS_PROJECT_ID>`.

## Commits

- `2d9b158` feat(cs-master): bris-parser-py — `extract_project_detail_data` 에 `amTeam` 분리
- `d72da10` feat(cs-master): bris_api — 단건 PROJECT_ID 4페이지 fetcher + 세션 만료 판별 (T2)
- `bcc3cf8` feat(cs-master): bris_to_supabase — `refresh_project_id` 백필 + CLI `project-id` mode (T2)
- `7bd201f` test(cs-master): T2 트랙 단위 테스트 (46건)

## Test plan

### 자동 검증 (이미 통과)

- [x] `apps/cs-master/tests/` 신규 46건 모두 PASS
  - `test_build_records_from_pages.py` 16/16 — sessions 0/N, deadline 정규화, echo_status 우선순위, company/customer_id 우선순위, am·amTeam·team, dm passthrough, revenue default, record shape 30 키
  - `test_bris_api_fetchers.py` 18/18 — `_check_session_html` 4 경로, 4 fetcher URL·params·tuple·HTTP 에러·세션만료 (parametrize 포함)
  - `test_refresh_project_id.py` 12/12 — happy path, echo OFF, customerId 부재, project_view/orderCode 실패, biz_list/echo 실패 tolerate, 세션만료 재로그인 3경로, sessions=0 cleanup
- [x] `apps/cs-master/lib/bris-parser-py/tests/` 회귀 27/27 PASS (AM 분리 변경에도 골든 안전)

### 사람 검증 필요 (Draft 유지 사유)

- [ ] 실 BRIS PROJECT_ID 로 `python apps/cs-master/bris_to_supabase.py project-id <ID>` 실행 — 4페이지 fetch + record 변환 + `cs_*` 업서트 + sync_logs 기록 확인. BRIS 자격증명 (`BRIS_USER_ID`, `BRIS_PASSWORD` 또는 `secrets/bris_cookies.json`) + `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` 필요
- [ ] 알려진 원격교육 PROJECT_ID 1~2건으로 dry-run 후 cs_projects/cs_courses 실데이터 spot check
- [ ] (선택) CLI 도움말 보강, `apps/cs-master/docs/` 운영 가이드 추가

### 환경 영향

- DB 스키마 변경 없음 (기존 `cs_*` 테이블 그대로 사용)
- Supabase 마이그레이션 없음
- 기존 모드 (`fetch` / `cron` / `refresh`) 동작 변경 없음

## 관련

- `apps/cs-master/docs/HANDOFF_현재상태.md` — 백필 트리거의 운영 컨텍스트
- `apps/cs-master/docs/operations-rollout.md` — L1 자동화 Stage 0 사전 점검과 직접 충돌 없음 (수동 백필 모드)
