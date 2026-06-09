# 제22회 인재개발 실태조사 — 진척 관리

> 자동 생성: 2026-05-28 10:27 (`scripts/update_dashboard.py` 출력)
> 단일 데이터 소스: `progress.yaml` — 직접 수정 후 스크립트 재실행

## 전체 요약

- 상태: **진행중**
- 시작: 2026-05-15 / 발간 목표: 2026-09
- **전체 진척률: 39%**
- 산출물 진척: 완료 14 / 진행 1 / 지연 0 / 대기 15 (총 30)

**비고**: 22회 raw 응답 수집 시작 예정 (2026-06 중순).
수집 종료 후 단계 2~5 가동.

## 마일스톤

| 일자 | 내용 | 상태 |
|---|---|---|
| 2026-05-15 | 프로젝트 시작 / 디렉토리 골격 완료 | 완료 |
| 2026-06-12 | 단계 0 (설문 검수·codebook·가이드) 확정 | 대기 |
| 2026-06-15 | 응답 수집 시작 | 대기 |
| 2026-08-01 | 응답 수집 종료 (가정) | 대기 |
| 2026-08-15 | 단계 3 (정제 DB) 완료 | 대기 |
| 2026-09-15 | 최종 PDF 발간 | 대기 |

## 단계별 진척

### 단계 0 — 설문 초안 검수

- 역할: 분석가 (자동 80%)
- 상태: **진행중**
- 진척: `████████████████░░░░` **80%**
- ETA: 2026-06-12
- 설명: 22회 설문 초안의 변경분 식별, codebook·가이드 22회 patch

| 산출물 | 경로 | 상태 |
|---|---|---|
| 22회 설문 초안 v0.2 배치 | `0_survey/survey_draft_v0.2.pptx` | 완료 |
| 변경분 식별 스크립트 | `scripts/stage0_diff_survey.py` | 완료 |
| 변경 이력 리포트 (1차 자동 분류 완료) | `0_survey/change_log_21_22.md` | 완료 |
| 22회 codebook (243컬럼, Part V 16/Part I R_11 신규) | `0_survey/codebook_22th.xlsx` | 완료 |
| 22회 분석가이드 (21회 사본 + 변경 notes 분석가 인계) | `0_survey/analysis_guide_22th.xlsx` | 진행중 |
| 분석가 인계용 변경 notes | `0_survey/guide_change_notes.md` | 완료 |

### 단계 1 — 응답 수집

- 역할: 응답자 (웹앱)
- 상태: **대기**
- 진척: `░░░░░░░░░░░░░░░░░░░░` **0%**
- ETA: 2026-08-01
- 설명: survey_sd 웹앱으로 응답 수집 + admin/hrd 대시보드 모니터링

| 산출물 | 경로 | 상태 |
|---|---|---|
| raw 응답 export | `1_raw/raw_22th.xlsx` | 대기 |

### 단계 2 — Raw 검증·이상치 자동 플래그

- 역할: 자동 (95%)
- 상태: **진행중**
- 진척: `████████████████░░░░` **80%**
- ETA: 2026-08-02
- 설명: drift 검증·완료 필터·단위 오류/극값 이상치 후보 산출

| 산출물 | 경로 | 상태 |
|---|---|---|
| 검증 스크립트 (drift + 완료필터 + 통계) | `scripts/stage2_validate_raw.py` | 완료 |
| 이상치 플래그 스크립트 (recall 90%) | `scripts/stage2_flag_outliers.py` | 완료 |
| 이상치 규칙 (single+cross_column+respondent) | `config/outlier_rules.yaml` | 완료 |
| 21회 정정 패턴 학습 (21건) | `config/correction_patterns.yaml` | 완료 |
| 21회 reverse-run recall 검증 | `tests/test_stage2_recall.py` | 완료 |
| 검증 통과 raw (22회 raw 도착 시) | `2_validated/raw_validated.xlsx` | 대기 |
| 이상치 리포트 (22회 raw 도착 시) | `2_validated/outlier_report.xlsx` | 대기 |

### 단계 3 — 정제 DB 작성 (분석가 검수)

- 역할: 분석가 (자동 30%)
- 상태: **진행중**
- 진척: `██████░░░░░░░░░░░░░░` **33%**
- ETA: 2026-08-15
- 설명: 이상치 검토·단위 보정·5항목 응답 필터 적용

| 산출물 | 경로 | 상태 |
|---|---|---|
| 분석가 검수 매뉴얼 (작업 흐름·정정 사례·체크리스트) | `docs/CLEANING_MANUAL.md` | 완료 |
| 정제 DB (raw 도착 후 분석가 작업) | `3_cleaned/All_확인완료_22th.xlsx` | 대기 |
| 정정 이력 (raw 도착 후) | `3_cleaned/corrections_log.xlsx` | 대기 |

### 단계 4 — 집계표·도표 데이터 산출

- 역할: 자동 (100%)
- 상태: **진행중**
- 진척: `█████████░░░░░░░░░░░` **45%**
- ETA: 2026-08-16
- 설명: 16시트 김태웅 형식 + 도표 48개 chart_data JSON 자동 생성

| 산출물 | 경로 | 상태 |
|---|---|---|
| 세그먼트 매핑 v1.1 (분석가 제외 표시 옵션 포함) | `config/segments.yaml` | 완료 |
| 도표 48개 사양 (가이드 → YAML) | `config/chart_specs.yaml` | 대기 |
| 김태웅 형식 집계기 v1.1 (모집단 제외 표시 지원) | `scripts/stage4_build_kim_xlsx.py` | 완료 |
| 도표 데이터 추출기 | `scripts/stage4_extract_chart_data.py` | 대기 |
| 21회 reverse-run 검증 (비율 ±5pp 94%, ±2pp 65%) | `tests/test_stage4_with_21th.py` | 완료 |
| 산업 10시트 v2 (분석가 수기 분류 보조) | `scripts/stage4_industry_v2.py` | 대기 |
| 22회 김태웅 형식 집계 | `4_aggregated/김태웅_22th.xlsx` | 대기 |
| 도표 데이터 JSON | `4_aggregated/chart_data_22th.json` | 대기 |

### 단계 5 — PPT 생성·검수·발간

- 역할: 분석가 + 디자이너 (자동 50%)
- 상태: **대기**
- 진척: `░░░░░░░░░░░░░░░░░░░░` **0%**
- ETA: 2026-09-15
- 설명: master_22th 채우기 → 디자이너 검수 → 분석가 최종 → PDF

| 산출물 | 경로 | 상태 |
|---|---|---|
| 22회 master PPTX | `5_report/master_22th.pptx` | 대기 |
| PPT 자동 채우기 스크립트 | `scripts/stage5_render_pptx.py` | 대기 |
| 전체 파이프라인 orchestrator | `scripts/run_pipeline.py` | 대기 |
| 22회 결과보고서 PPTX | `5_report/result_22th.pptx` | 대기 |
| 22회 결과보고서 PDF (최종) | `5_report/result_22th.pdf` | 대기 |

## 작업 이력 (Worklog)

### [2026-05-28 10:27] 단계 0 · 결정 — Part I 컬럼명 webapp 정렬 (raw=truth)

5/27 raw 조기 도착(40건, 완료 10건)으로 codebook ↔ raw 사이 Part I 23쌍 드리프트 발견. 5/20 export_alignment 의 canonical 가정(PPTX=21회 이름)이 5/27 webapp 운영본·실응답과 reverse 임을 확인. webapp form (research.exc.co.kr/RAC/survey/view/hrd_2026/{1..5}) = raw _All.xlsx = canonical 로 재정의. scripts/stage0_rename_part1.py 작성·실행하여 codebook Part I 26 컬럼명을 22회 신코드로 일괄 rename, 21회_매핑 신규 열로 21회 코드 보존, R_2_n_2 하위항목 연도 25년 갱신. config/chart_specs.yaml 33건·0_survey/guide_change_notes.md 1건 후속 치환. 5/20 도구 (workspace/regen_codebook_export_order.py·verify_after_regen.py) 와 export_alignment_22th.md 는 OBSOLETE 처리. drift 0 확인.

**산출물**:
- `0_survey/codebook_22th.xlsx`
- `scripts/stage0_rename_part1.py`
- `workspace/part1_rename_map.yaml`
- `workspace/codebook_correction_plan.md`
- `workspace/mapping_webapp_vs_codebook.md`
- `config/chart_specs.yaml`
- `0_survey/guide_change_notes.md`
- `0_survey/export_alignment_22th.md`
- `config/codebook_patch_22th.yaml`

### [2026-05-20 17:27] 단계 5 · 산출물 — (b) mean_pct 정규화 + (a) 작업대 UI 골격 세팅 (다음 세션 진입 준비)

(b) 집계기 mean_pct를 그룹 일관 분모로 정규화(빈칸=0% 배분, 현재/향후 _3/_4 분리, _etc 제외): 교육형태 인원비율 121→100. (a) FastAPI+HTMX 골격 app/main.py+templates: 상태판은 엔진 실연결(기업235/공공65/중복9), 5탭 스텁. assign_ids 멱등화. 기존 test 2개 stdout 가드(pytest 캡처 충돌 수정). pyproject app/dev deps. 진입문서 docs/SESSION_STARTER_app.md. pytest 30건 통과(앱 스모크 포함).

**산출물**:
- `scripts/stage4_extract_chart_data.py`
- `scripts/curation_engine.py`
- `app/main.py`
- `app/templates/base.html`
- `app/templates/status.html`
- `app/templates/stub.html`
- `tests/test_app_smoke.py`
- `docs/SESSION_STARTER_app.md`
- `pyproject.toml`

### [2026-05-20 17:15] 단계 4 · 산출물 — 정제 필터 합의 config 반영 + 21회 재검증 (기업/공공 분리)

POPULATION_FILTER_SPEC_22th 구현: segments.yaml population_filter를 corporate(R_Div1-3,직원수+예산/집행)/public(R_Div4-5,직원수)로 분리, 매출·R_Cate 필수 제거. stage4_build_kim main() build_pop+시트별 population. stage4_extract_chart_data build_population(기업∪공공)+segment_masks R_Div분기(전체=기업,size_tier 공공컬럼 별도). 21회 재검증: 기업235/공공65, 공공조직시트 N=65(이전0→한계2해소), 규모별 45/49/37/45/59=235. pytest 26건 통과(test_corporate_public_split 추가). 김태웅 차이=문서화된 black box(L4 임의제외).

**산출물**:
- `config/segments.yaml`
- `scripts/stage4_build_kim_xlsx.py`
- `scripts/stage4_extract_chart_data.py`
- `tests/test_chart_data_21th.py`
- `docs/POPULATION_FILTER_SPEC_22th.md`

### [2026-05-20 16:58] 단계 3 · 결정 — 정제 필터 5계층 합의 확정 (POPULATION_FILTER_SPEC_22th)

L1 완료(tesmi_status). L2 중복(org_key 1건,완성도→최신,충돌검토). L3 핵심지표 기업=직원수+교육예산/공공=직원수, 매출 비필수. L4-a 공공 별도집계(21회 혼합과 의도적 차이). L4-b 임의제외=분석가 재량 허용+로그 필수(21회 ~80명 무사유 일괄제외 금지). L5 소수업종 N<10→기업기타. 한계2(공공 모집단) 해소=기업+공공 분리. 구현영향: segments.yaml required_columns에서 R_Cate·매출 제거+교육예산 추가, 기업/공공 분기.

**산출물**:
- `docs/POPULATION_FILTER_SPEC_22th.md`

### [2026-05-20 15:38] 단계 4 · 산출물 — 정제·집계 CLI 엔진 21회 시험 — 라운드어댑터+결정엔진+집계기 (25테스트 통과)

raw 없이 21회 cleaned(305)로 김태웅 핵심 엔진 선제작·검증. round_adapter(21→22 이름변환, native R_9_1_* drop·충돌안전), curation_engine(ingest/dedup/apply, 멱등성·검토플래그3), stage4_extract_chart_data(응답방식 자동추론 mean/dist/mean_pct/likert/multi_rate, size_tier roll-up). chart_specs 거시지표 primary_var/formula 보강(매출대비교육비 1.42%, 1인당 89.7만원). 김태웅 인력규모 분포 ±5pp 이내. pytest 25건 통과. 한계: mean_pct 합>100·공공 모집단 정의 통일 필요.

**산출물**:
- `scripts/round_adapter.py`
- `scripts/curation_engine.py`
- `scripts/stage4_extract_chart_data.py`
- `config/round_var_map_21_22.yaml`
- `config/chart_specs.yaml`
- `tests/test_curation_21th.py`
- `tests/test_chart_data_21th.py`
- `tests/ENGINE_TEST_21th_report.md`

### [2026-05-20 13:25] 단계 3 · 결정 — 정제·집계 GUI 구현 전 확정 5건 결정

1)프레임워크=FastAPI+HTMX/Jinja. 2)식별자=resp_id(행,R%04d+해시고정)/org_key(조직,사업자번호>회사명정규화) 분리. 3)중복제거=조직1건 자동추천(완성도최대→최신regdate)+수기override, 분류불일치그룹 검토플래그, 비선택은 dedup_dropped 추적. 4)순서=재분류확정→모집단확정→주요업종선정, 선정=재분류후 카운트≥10 추천+수기확정. 5)집계=코드북 응답방식+접미사 자동추론(mean/mean_pct/dist/multi_rate/likert/rank)+chart_specs override. 21회 중복 실측: 8개 사업자번호 그룹 모두 동일조직 담당자2명, 사업자번호 99% 충실.

**산출물**:
- `docs/CURATION_APP_DESIGN.md`
- `workspace/dedup_study.py`

### [2026-05-20 13:04] 단계 3 · 결정 — 김태웅 정제·집계 프로세스 + 관리 GUI 설계 (구현 보류)

결정: 독립 경량 로컬앱(1인) / 작업대+상태판 동등 / 프레임워크 미확정. 핵심 설계: decisions_22th.yaml(분석가 결정 원장)을 단일 진실원으로, 정제 DB는 raw+decisions 멱등 파생 → 21회 black box 추적가능화. resp_id(사업자번호>+regdate>행순서), 결정 3유형(correction/exclusion/reclassification) 스키마, corrections_log 포맷, 모집단 확정 공식, 화면6탭, 빌드 7단계 정의. 구현 전 확정 5건(프레임워크/resp_id폴백/중복규칙/업종재분류 시점/chart_data 산출기).

**산출물**:
- `docs/CURATION_APP_DESIGN.md`

### [2026-05-20 11:40] 단계 4 · 산출물 — chart_specs.yaml v1 생성 + 가이드 세그먼트 규칙 반영 검증

가이드 도표 인벤토리(112) + codebook(export교정본) 변수매핑 결합 → config/chart_specs.yaml v1 자동생성: 도표47/세부112/변수매칭108. segment_defs(size_tier 5구간→3단계 roll-up, major_industry 선정규칙, public) 명시. 신규도표 후보 2건 포함. 별건 검증: 규모구간=가이드 3단계는 김태웅 5구간의 roll-up(층위차, 정합). 주요업종 '10이상 개별분석'은 재분류 후 최종카운트 기준 적용(금융raw9→11포함/건설raw10→0제외), 6~7개 아닌 8개. segments.yaml은 roll-up·선정규칙 미인코딩이라 chart_specs에 보강.

**산출물**:
- `config/chart_specs.yaml`
- `docs/SEGMENT_RULE_VERIFICATION_21th.md`
- `workspace/gen_chart_specs.py`
- `workspace/verify_guide_rules.py`

### [2026-05-20 11:20] 단계 3 · 분석 — 21회 N=206 모집단 축소 추론 + 가이드 도표→export 변수 매핑 초안

참고_2025/analyis 4파일 분석: raw620(완료303)→확인완료305→김태웅206. 305→206(-99)=민간236→150(-86)+공공65→56(-9)+무효4. 결정론적 규칙(완료/5필수237/완성도/전파트299) 모두 206 불일치, 1000이상 구간 237기준59<김태웅60(+1)→부분집합아님→분석가 수기 curation(업종 재분류+개별제외) 확정. 22회는 역산 대신 사전 명시적 필터 5계층(완료/중복/핵심지표/모집단/업종재분류) 정의 권장. 별건: 가이드 도표 112행/질문지ref 56종 → codebook_22th(export교정본) 설문항목 매칭, 55/56 자동매칭(미매칭 I-5-3=22회삭제). 신규도표후보 2건(I-5-4 AI비율, V-11 AI계획).

**산출물**:
- `docs/POPULATION_FILTER_ANALYSIS_21th.md`
- `0_survey/chart_var_mapping_22th.md`
- `workspace/reverse_206.py`
- `workspace/map_charts_to_vars.py`

### [2026-05-20 11:05] 단계 0 · 산출물 — raw export 양식 ↔ 설문지 v0.2 정렬 + codebook_22th.xlsx export 기준 재생성

제 22회…_All.xlsx(웹앱 raw export 243컬럼)을 설문지 v0.2 PPTX 기준으로 검증. export=설문지=canonical 확정. 05-15 codebook_22th.xlsx가 Page1(변수명 14건 + AI/투자효과 순서) · p5)R_8(접미사) 어긋남 발견. R_7_1_2 이름충돌(교육시간 vs 지출집합)도 식별. codebook_22th.xlsx를 export 순서로 재생성(불일치 0 검증). segments.yaml 예산변동 R_2_n_2→R_3_n_2 파이프라인 버그 수정. patch yaml 한계 경고+후처리 명시.

**산출물**:
- `0_survey/export_alignment_22th.md`
- `0_survey/codebook_22th.xlsx`
- `config/segments.yaml`
- `config/codebook_patch_22th.yaml`
- `workspace/regen_codebook_export_order.py`

### [2026-05-15 12:34] 단계 3 · 산출물 — 단계 3 분석가 검수 매뉴얼 작성

단계 2 산출물(outlier_report)을 받아 정제 DB를 만드는 5단계 절차서.
- 21회 정정 사례 21건을 의사결정 가이드로 정리
- 단위 보정 패턴 (×1억, ×0.1, ×0.01) 사례 표
- 김태웅 모집단 일치를 위한 excluded_from_kim 표시 절차
- 검증 체크리스트 + 다음 단계 트리거
- FAQ 5항목 (false positive, 무응답, 신규 패턴 등)

**산출물**:
- `docs/CLEANING_MANUAL.md`

### [2026-05-15 11:55] 단계 2 · 산출물 — 단계 2 v1 — 검증·이상치 플래그 도구 + 21회 recall 90%

stage2_validate_raw.py + stage2_flag_outliers.py 작성.

outlier_rules.yaml = 9 single_column + 3 cross_column + 1 respondent 규칙.
correction_patterns.yaml = 21회 정정 21건 학습 (분석가 참고용).

21회 raw reverse-run:
- 자동 이상치 후보 216건 (medium 113 / high 52 / critical 51)
- 정정 21건 중 19건 자동 플래그 (Recall 90%)
- 미감지 2건 = budget/revenue 비율 1% 미만이지만 단위 오류 케이스 (분석가 수기 검수 영역)

**산출물**:
- `scripts/stage2_validate_raw.py`
- `scripts/stage2_flag_outliers.py`
- `config/outlier_rules.yaml`
- `config/correction_patterns.yaml`
- `tests/test_stage2_recall.py`
- `tests/test_stage2_report.md`

### [2026-05-15 11:39] 단계 4 · 발견 — v1 검증 결과 — 비율 기반 94% 일치 (±5pp)

비율 기반 검증 추가로 자동화 정확도 명확.

전체 시트 17 라벨 종합:
- ±2pp 일치: 11/17 (65%)
- ±5pp 일치: 16/17 (94%)
- 인력규모/매출/예산 자동 구간 매핑 검증 통과

남은 차이 1pp 는 김태웅 산업 수기 분류 31명 영향 (자동화 영역 밖).
segments.yaml 에 optional_exclusion_column 옵션 추가 — 분석가가 정제 DB 에 'excluded_from_kim=true' 표시 시 정확히 일치 가능.

**산출물**:
- `tests/test_stage4_report.md`
- `config/segments.yaml`
- `scripts/stage4_build_kim_xlsx.py`

### [2026-05-15 11:27] 단계 4 · 산출물 — 단계 4 v1 — 김태웅 형식 집계기 작성 + 21회 검증

config/segments.yaml 정의 (7시트 + 4컬럼 그룹) + 자동 생성기 + 검증 스크립트.

검증 결과 (workspace/test_kim_21th_v1.xlsx vs reference/21th_kim.xlsx):
- v1 모집단 N=237 vs 김태웅 N=206 — 차이 +31 = 김태웅 산업 수기 분류 단계 제외분
- 인력규모 5시트 자체 일치율: 4/5 (각 80%)
- 1000이상 시트에서 v1=59 vs 김태웅=60 (-1) 미세 차이 추적 필요
- 매출/예산 그룹은 모집단 +15% 영향으로 빈도 모두 v1 큼
→ 자동화는 정상, 차이는 김태웅 산업 분류 31명에서 기인

**산출물**:
- `config/segments.yaml`
- `scripts/stage4_build_kim_xlsx.py`
- `workspace/test_kim_21th_v1.xlsx`
- `tests/test_stage4_with_21th.py`
- `tests/test_stage4_report.md`

### [2026-05-15 11:05] 단계 4 · 결정 — 결정 — 집계기 v1 = 자동 영역만, 산업 분류는 v2/수기

v1 범위: 전체 시트 + 인력규모 5시트 + 컬럼 그룹 1)업종(raw)/2)인력규모/3)매출/4)예산/5)예산변동.
v2 (후속): 산업 10시트 — 분석가 수기 재분류 보조 도구.
KPI: 인력규모 시트의 김태웅 정답 일치율 (산업 시트는 raw 기준 인정).

### [2026-05-15 11:00] 단계 4 · 분석 — 단계 4 — 김태웅 16시트 reverse-engineer

21회 정제 DB(305) → 김태웅(N=206) 매핑 시도.
• 인력규모/매출/예산/예산변동 구간: 100% 자동화 가능 (단순 cut)
• 산업 분류 R_Cate: 자동 불가 — etc 38명을 R_Cate_Name 기반으로 분석가 수기 재분류
• R_Div=4(공공 60) + R_Div=5(학교 5) = 65 → 김태웅 공공/공공기타 56 (-9 추가 제외)

**산출물**:
- `workspace/reverse_kim_mapping.py`

### [2026-05-15 10:56] 단계 0 · 결정 — 결정 — 가이드는 자동 patch 대신 분석가 수기 편집

가이드 xlsx 는 결합셀·서식 많아 자동 patch 깨질 위험.
대신 21회 사본 + 변경 사항 체크리스트(8개 항목)를 분석가에게 인계.
매년 도구 재사용성 vs 정확성 트레이드오프 — 정확성 우선.

**산출물**:
- `0_survey/analysis_guide_22th.xlsx`
- `0_survey/guide_change_notes.md`

### [2026-05-15 10:53] 단계 0 · 산출물 — 단계 0 — 22회 codebook patch (243컬럼)

YAML 사양 + 자동 patch 스크립트로 21회 248컬럼 → 22회 243컬럼.
Part V 15→16, Part I R_11 신규, 공공직급 6 삭제, sub_item·response_format·HRD이슈 항목 갱신.

**산출물**:
- `config/codebook_patch_22th.yaml`
- `scripts/stage0_patch_codebook.py`
- `0_survey/codebook_22th.xlsx`
- `0_survey/codebook_patch_report.md`

### [2026-05-15 10:45] 단계 0 · 발견 — 발견 — Part V (AI) 대대적 개편

22회 변경의 핵심:
• Part V slide 20·21: 추가 43개 옵션 / 삭제 37개 (AI 도입 단계·교육 분야·기대 성과·만족도·향후 계획 등)
• Part I slide 2 (옵션 +1), slide 3 (공공 직급별 표 삭제), slide 4 (AI 교육 비율 신규)
• Part III/IV: sub_item 라벨 3건 교체 (DEI→팀단위, 잡크래프팅→CDP, 디지털역량→저성과자)

**산출물**:
- `0_survey/change_log_21_22.md`

### [2026-05-15 10:42] 단계 0 · 산출물 — 단계 0 — 22회 설문 v0.2 → 변경분 자동 식별

22회 PPTX 텍스트 추출 + 21회 baseline 과 slide 단위 diff.
11개 slide 변경 식별, 자동 분류 (TRIVIAL/A/B/C/D/E).

**산출물**:
- `scripts/stage0_diff_survey.py`
- `0_survey/survey_22th_extracted.txt`
- `0_survey/change_log_21_22.md`

### [2026-05-15 09:42] 골격 · 산출물 — 진척 관리 시스템 v1 (progress.yaml + 대시보드)

단일 데이터 소스 progress.yaml → 자동 생성 MD + HTML 대시보드.
산출물 단위 진척률 자동 계산, 단계별 카드/마일스톤 타임라인 포함.

**산출물**:
- `progress.yaml`
- `scripts/update_dashboard.py`
- `dashboard/index.html`
- `docs/PROGRESS.md`

### [2026-05-15 09:38] 골격 · 세팅 — reference 21회 4개 자료 복사

21회 raw / cleaned / kim / guide 를 reference/ 에 사본 보관. 단계 4 검증의 정답지 역할.

**산출물**:
- `reference/21th_raw.xlsx`
- `reference/21th_cleaned.xlsx`
- `reference/21th_kim.xlsx`
- `reference/21th_guide.xlsx`
- `reference/21th_survey_extracted.txt`

### [2026-05-15 09:35] 골격 · 산출물 — 워크플로우·READINESS 문서 작성

6단계 (0~5) 명세서 작성. 각 단계의 입력·처리·출력·검증·자동도 정의.
raw 도착 전·후 도구 준비 우선순위 표.

**산출물**:
- `docs/WORKFLOW.md`
- `docs/READINESS.md`

### [2026-05-15 09:30] 골격 · 세팅 — 22회 프로젝트 디렉토리 골격 세팅

hrd_report_template 와 분리된 22회 전용 워크스페이스 생성.
단계 = 폴더 = 산출물 구조. config·docs·scripts·reference·workspace 분리.

**산출물**:
- `README.md`
- `pyproject.toml`
- `.gitignore`
- `0_survey/ ~ 5_report/ (6 단계 폴더)`
