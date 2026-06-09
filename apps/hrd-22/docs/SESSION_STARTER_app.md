# 다음 세션 진입점 — 정제·집계 작업대 UI (FastAPI+HTMX)

> 목적: 검증된 CLI 엔진 위에 작업대 화면(분석가 결정 + 상태 모니터링)을 올린다.
> 이 문서만 읽으면 바로 (a) UI 구현을 이어갈 수 있다.

## ▶ 새 세션 시작 프롬프트 (복붙)

```
22회 인재개발 실태조사 — 정제·집계 작업대 UI 이어서 빌드.
먼저 D:\00.26년업무\07.HR실태조사\22회_2026\docs\SESSION_STARTER_app.md 를 읽고 현재 상태 파악.

검증된 엔진(curation_engine · stage4_extract_chart_data) 위에 FastAPI+HTMX 화면을
빌드 3~7 순서로 이어간다: 3 이상치검토 → 4 업종재분류 → 5 포함/제외 → 6 산출/미리보기 → 7 이력.
- 결정은 config/decisions_21th.yaml 에 append, 적용은 curation_engine.apply_decisions 재사용
- HTMX 부분 갱신(hx-post로 결정 저장 → 행/카드만 리렌더)
- 화면 하나마다 tests/ 스모크 추가하고 pytest tests/ 로 확인 (현재 30건 통과)
먼저 3(이상치 검토)부터 시작하자.
```

> 짧은 버전: `docs/SESSION_STARTER_app.md 읽고 작업대 UI 빌드 3(이상치 검토)부터 이어가줘`

## 지금까지 (완료)
- 엔진 3종 검증 완료 (21회 데이터, pytest 30건): `tests/ENGINE_TEST_21th_report.md`
  - `scripts/round_adapter.py` — 21→22 변수명 변환(22회 raw엔 불필요)
  - `scripts/curation_engine.py` — ingest / dedup / apply (결정 원장, 멱등)
  - `scripts/stage4_extract_chart_data.py` — 도표 집계(응답방식 자동추론, mean_pct 정규화)
- 정제 필터 5계층 합의·반영 완료: `docs/POPULATION_FILTER_SPEC_22th.md`
  - 기업 모집단(R_Div 1·2·3) + 공공 별도(4·5). 21회 재검증 기업235/공공65.
- 앱 골격 + 상태판 동작: `app/main.py` (`uvicorn app.main:app --reload` → http://127.0.0.1:8000)
  - 상태판은 엔진에 실연결(기업/공공 N·중복 그룹).
- **빌드 3·4·5 완료** (작업대 3화면, HTMX 부분 갱신 + 결정 원장 append, pytest 41건):
  - 3 이상치 검토: `app/outliers.py` + `/outliers` — cleaned DB에 stage2 규칙 직접 적용(flag.row_idx↔resp_id 정합),
    행별 승인/무시(신규 `outlier_review` 결정, 데이터 불변) / 보정(`correction`). 미결 집계 OOB 갱신.
  - 4 업종 재분류: `app/reclassify.py` + `/reclassify` — 기업 etc 38건, 자유응답 보고 표준 업종 매핑(`reclassification`).
  - 5 포함/제외: `app/exclude.py` + `/exclude` — 검색 + 제외/복원 토글(`exclusion`), 실시간 모집단 N(236↔235 검증).
  - 공용: `app/store.py`(결정 원장 load/append). `curation_engine.apply_decisions`에 `outlier_review` no-op 분기 1줄 추가.
- **빌드 6 완료** (산출/미리보기): `app/build.py` + `/build` — 결정 적용(`apply_decisions`) 스냅샷 → 검증된 stage4 2종을
  그대로 subprocess 실행 → 김태웅 7시트 + chart_data 108도표(기업235/공공65) 요약 + 신선도(원장 last_updated 대비) 표시.
  산출물은 `4_aggregated/_app_*`(파생물, fixture와 분리). pytest 44건.

## 설계 (구현 명세)
- 화면 6탭·데이터 흐름·결정 스키마: `docs/CURATION_APP_DESIGN.md`
- 결정 원장 = 단일 진실원(`decisions_*.yaml`), 정제 DB는 raw+decisions 멱등 파생.

## 빌드 순서
```
2. (완료) 앱 골격 + 상태판
3. (완료) 이상치 검토 화면   → 행별 승인/무시(outlier_review)/보정(correction)
4. (완료) 업종 재분류 화면   → etc → 표준 라벨 매핑 → decisions(reclassification)
5. (완료) 포함/제외 화면     → excluded 토글 + 실시간 N → decisions(exclusion)
6. (완료) 산출/미리보기      → 결정적용 스냅샷 → stage4 2종 subprocess + 요약/신선도
7. ▶다음 이력              → decisions 원장 조회 + corrections_log.xlsx export
```
- HTMX 부분 갱신(`hx-post`로 결정 저장 → 행/카드만 리렌더).
- 결정 저장 = `config/decisions_21th.yaml`(시험) 에 append. apply는 `curation_engine.apply_decisions` 재사용.

## 엔진 호출 인터페이스 (재사용)
- `curation_engine.load_df(path)`, `assign_ids(df)`(멱등), `completeness(df)`, `apply_decisions(df, decisions)→(out, warns)`
- `stage4_extract_chart_data.build_population(df, pf)`, `infer_agg(resp_format)`
- 모집단 정의: `config/segments.yaml` `population_filter`(corporate/public)

## 실행·검증
```
pip install -e ".[app,dev]"          # 필요시 (스택은 이미 설치돼 있음)
uvicorn app.main:app --reload
pytest tests/                         # 현재 30건 통과 (앱 스모크 포함)
```

## 데이터 전환 (21회 시험 → 22회 본가동)
- `app/main.py` `DATA` 상수를 `3_cleaned/All_확인완료_22th.xlsx` 로 교체.
- 22회 raw는 이미 22회 이름이므로 `round_adapter` 불필요. 나머지 엔진 동일.

## 미해결 (UI와 별개)
- 21회 민간 ~80명 black box는 재현 안 함(L4 임의제외 정책으로 대체).
- 거시지표 primary_var는 도표3·5·6·7만 지정 — 나머지 묶음 도표 보강 여지.
