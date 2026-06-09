# 22회 워크플로우 명세

> 22회 인재개발 실태조사의 raw 응답이 최종 리포트로 변환되는 단계별 파이프라인.
> 각 단계는 명확한 입력·출력·검증 기준·다음 트리거를 가짐.

---

## 단계 0 — 설문 초안 검수 (raw 수집 시작 전)

### 목적
22회 설문 초안의 변경분을 식별하고, codebook·가이드를 22회 버전으로 patch.

### 입력
- `0_survey/survey_draft_v0.2.pptx` (22회 설문 초안)
- `reference/21th_guide.xlsx` (21회 분석가이드, baseline)
- `reference/21th_cleaned.xlsx` 의 `코드표` 시트 (21회 codebook, baseline)

### 처리
1. `stage0_diff_survey.py` — 21회 설문지(PPTX) 와 22회 초안 비교 → `0_survey/change_log_21_22.md`
2. `stage0_patch_codebook.py` — 21회 codebook + diff → `0_survey/codebook_22th.xlsx`
3. `stage0_build_guide.py` — 21회 가이드 + 변경분 → `0_survey/analysis_guide_22th.xlsx`

### 출력
- `0_survey/change_log_21_22.md`
- `0_survey/codebook_22th.xlsx`
- `0_survey/analysis_guide_22th.xlsx`

### 검증 기준
- 변경된 컬럼이 모두 codebook 에 반영됐는가
- 신규/삭제 도표가 가이드에 반영됐는가
- 분석가 1차 검토 통과

### 자동도
80% (수기 검수 필요 — 변경 분석은 자동, 최종 확정은 분석가)

---

## 단계 1 — 응답 수집 (응답 기간)

### 목적
응답자로부터 22회 raw 응답 수집.

### 입력
- 확정된 설문지 (22회 v1.0 이후)
- 응답자 풀

### 처리
- survey_sd 웹앱(`..\..\06_CS\01.설문관리\survey_sd\`) 으로 응답 수집
- admin/hrd 대시보드로 진행 모니터링

### 출력
- `1_raw/raw_22th.xlsx` (수집 종료 후 export)

### 검증 기준
- 응답 종료 시점에 목표 응답 수 달성 (예: 300건+)
- 미완료/완료 비율 확인

### 자동도
100% (웹앱)

---

## 단계 2 — Raw 검증·이상치 자동 플래그 (수집 종료 직후)

### 목적
raw 의 구조적 정합성을 자동 검증하고, 분석가 수기 검수 대상이 될 이상치를 자동으로 모음.

### 입력
- `1_raw/raw_22th.xlsx`
- `0_survey/codebook_22th.xlsx`
- `config/outlier_rules.yaml`

### 처리
1. `stage2_validate_raw.py` — drift 검증(컬럼·옵션 정합성), 완료 필터, 응답 수 통계
2. `stage2_flag_outliers.py` — 이상치 후보 자동 플래그
   - 단위 오류 의심 (예: 매출 < 1억 또는 > 1조)
   - 비율 오류 의심 (예: 교육비/매출 > 0.1)
   - 0/극값 응답
   - 21회 patterns 학습 (`config/correction_patterns.yaml`)

### 출력
- `2_validated/raw_validated.xlsx` — 완료 필터 + drift 통과한 응답만
- `2_validated/outlier_report.xlsx` — 이상치 후보 리스트 (응답자×컬럼)
- `2_validated/drift_report.txt` — 컬럼 정합성 리포트

### 검증 기준
- drift 0건 (모든 raw 컬럼이 codebook 과 매칭)
- outlier_report 가 분석가에게 인계 가능한 형태

### 자동도
95% (값 *플래그만*, 자동 정정은 하지 않음 — 분석가 판단 보장)

---

## 단계 3 — 정제 DB 작성 (분석가 수기 검수)

### 목적
이상치 플래그를 분석가가 검토하여 단위 보정·무효 처리·5항목 응답 필터 적용. 결과는 김태웅 21회와 동등한 품질의 정제 DB.

### 입력
- `2_validated/raw_validated.xlsx`
- `2_validated/outlier_report.xlsx`
- `docs/CLEANING_MANUAL.md` (21회 정정 사례 21건 baseline)

### 처리
- 분석가가 outlier_report 행별 판정 (정정·무효·그대로)
- 정정 이력을 `corrections_log.xlsx` 에 기록 (누가·언제·왜)
- 5항목 응답 (R_Cate, 인원수, 매출, 예산, 예산변동) 모두 응답한 행만 유지 → 분석 모수 확정

### 출력
- `3_cleaned/All_확인완료_22th.xlsx` (정제 DB)
- `3_cleaned/corrections_log.xlsx` (정정 이력)

### 검증 기준
- 분석가 서명
- 모든 outlier 가 처리됨 (open 상태 0건)
- 분석 모수 N 확정

### 자동도
30% (분석가 수기 핵심)

---

## 단계 4 — 집계표·도표 데이터 산출 (자동)

### 목적
정제 DB 에서 도표별 집계를 자동 생성. 분석가가 검수할 김태웅 형식 xlsx 와, PPT 자동 생성용 JSON 두 가지를 동시 산출.

### 입력
- `3_cleaned/All_확인완료_22th.xlsx`
- `0_survey/analysis_guide_22th.xlsx`
- `config/segments.yaml` (산업 14개 · 인력규모 5구간 매핑)
- `config/chart_specs.yaml` (도표 48개 사양)

### 처리
1. `stage4_build_kim_xlsx.py` — 16시트(전체 + 산업10 + 규모5) 빈도·비율 자동 산출
2. `stage4_extract_chart_data.py` — 도표 48개의 (카테고리·값·N) 을 JSON 으로 export

### 출력
- `4_aggregated/김태웅_22th.xlsx` (16시트, 분석가 검수용)
- `4_aggregated/chart_data_22th.json` (PPT 자동화용)

### 검증 기준
- 21회 reference 로 reverse-run 시 김태웅 21회와 0.1pp 이내 일치
- 합계 행 = 1.0 (비율) / 분모 N (빈도) 정확

### 자동도
100%

---

## 단계 5 — PPT 생성·검수·발간

### 목적
도표 데이터로 PPT 자동 채우기 → 디자이너·분석가 검수 → PDF 발간.

### 입력
- `4_aggregated/chart_data_22th.json`
- `5_report/master_22th.pptx` (디자인 마스터)
- `..\hrd_report_template\` (PPT 자동 생성 모듈 재사용)

### 처리
1. `stage5_render_pptx.py` — chart_data → master 에 채워 `result_22th.pptx` 생성
2. 디자이너 검수 (디자인 마무리)
3. 분석가 검수 (수치·문구)
4. PDF export

### 출력
- `5_report/result_22th.pptx` (편집본)
- `5_report/result_22th.pdf` (최종)

### 검증 기준
- 모든 도표 카테고리·값이 김태웅 22th xlsx 와 일치
- 디자인 마무리 통과
- 분석가 최종 서명

### 자동도
50% (자동 1차안 + 수기 검수·디자인)

---

## 단계 간 트리거

```
[0] 설문 v1.0 확정      → [1] 응답 수집 시작
[1] 수집 종료           → [2] 자동 검증 (당일)
[2] 검증 통과           → [3] 분석가 검수 (1~2일)
[3] 분석가 서명         → [4] 자동 집계 (분 단위)
[4] reverse-run 통과    → [5] PPT 생성 + 검수 (3~5일)
[5] 분석가·디자이너 서명 → 발간
```

## 단계별 자동도 요약

| 단계 | 자동도 | 핵심 책임 |
|---|---:|---|
| 0 | 80% | 분석가 (설문 검수) |
| 1 | 100% | 웹앱 |
| 2 | 95% | 자동 + 분석가 인계 |
| 3 | 30% | **분석가 (정확성 핵심)** |
| 4 | 100% | 자동 |
| 5 | 50% | 디자이너 + 분석가 |
