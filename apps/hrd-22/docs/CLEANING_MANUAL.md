# 단계 3 — 정제 DB 작성 매뉴얼 (분석가용)

> 단계 2 자동 검증·이상치 플래그 결과를 받아 정제 DB 를 완성하는 절차.
> 22회 raw 응답 수집 종료 후 1~2일 작업.
> 이 단계의 정확성이 최종 리포트 수치의 핵심.

---

## 0. 한눈 요약

```
[단계 2 산출물 (자동)]            [단계 3 작업 (수기)]              [단계 3 산출물]
2_validated/raw_validated.xlsx ─┐
2_validated/outlier_report.xlsx ─├─► 분석가 검수 + 단위 보정 ─► 3_cleaned/All_확인완료_22th.xlsx
2_validated/drift_report.md     ─┘                              3_cleaned/corrections_log.xlsx
```

**목표**: 단위 오류, 무응답, 응답 불성실 등을 분석가가 케이스별로 판정 → 김태웅 21회 수준의 품질 정제 DB.

**예상 시간**: 21회 기준 약 21건 정정 → 22회 비슷한 규모 가정 시 1~2일 (응답자 후속 확인 포함).

---

## 1. 사전 준비

### 1.1 입력 파일 확인

`2_validated/` 디렉토리에 다음 3개 파일이 있어야 합니다:

| 파일 | 내용 |
|---|---|
| `raw_validated.xlsx` | tesmi_status='완료' 필터 통과한 응답 (1시트) |
| `outlier_report.xlsx` | 이상치 후보 (시트 `flags` + `summary`) |
| `drift_report.md` | 컬럼 정합성 리포트 (codebook 과 raw 차이) |

### 1.2 참고 자료

- `0_survey/codebook_22th.xlsx` — 컬럼 정의 (해석 시 참조)
- `config/correction_patterns.yaml` — 21회 정정 사례 21건 (의사결정 참고)
- `reference/21th_cleaned.xlsx` — 21회 최종 정제 DB 형식 (산출물 형식 참고)

---

## 2. 작업 단계 (5단계)

### 2.1 단계 A — drift_report 검토

**확인 사항**:
- codebook 정의가 있으나 raw 에 없는 컬럼 (`missing`) → 응답자 데이터 누락? 또는 코드북 22회 patch 누락?
- raw 에 있으나 codebook 정의 없는 컬럼 (`extra`) → 22회 신규 문항? 코드북 patch 필요?

**조치**:
- drift 가 있으면 1차적으로 codebook 보강 후 단계 0 재실행
- drift 0 이면 단계 B 진행

### 2.2 단계 B — outlier_report 검수 (핵심 작업)

`outlier_report.xlsx` 의 `flags` 시트를 열어 행마다 판정.

**필수 컬럼**:
| 컬럼 | 의미 |
|---|---|
| `row_idx` | raw_validated 의 행 번호 |
| `R_Company_Name` | 응답자 회사명 |
| `rule_id` | 적용된 규칙 (예: 매출_단위의심_과소) |
| `column` | 영향 컬럼 (또는 expression) |
| `value` | 현재 값 |
| `severity` | critical / high / medium |
| `note` | 규칙 설명 |

**판정 결과 컬럼 추가** (각 row 에 직접 입력):
- `decision` — `keep` | `fix` | `invalid` | `request`
  - `keep`: 값 그대로 유지 (false positive)
  - `fix`: 값 보정 (보정값 입력)
  - `invalid`: 응답 무효 처리 (해당 셀 → 0 또는 NaN)
  - `request`: 응답자에게 후속 확인 요청 (보류)
- `fixed_value` — `fix` 일 때 새 값
- `note` — 판정 사유

### 2.3 단계 C — 정정 적용

검수 완료 후 `corrections_log.xlsx` 에 정정 이력 기록:

| 컬럼 | 예시 |
|---|---|
| timestamp | 2026-08-05 14:30 |
| company | 에스비아이저축은행 |
| col | p1)R_1_5_2 |
| raw_value | 7 |
| new_value | 700000000 |
| decision | fix |
| rule_id | 교육예산_단위의심_과소 |
| analyst | 김분석 |
| reason | 응답자 확인 — 7억원 의도 |

같은 정정을 `raw_validated.xlsx` 에 직접 반영 → 결과를 `3_cleaned/All_확인완료_22th.xlsx` 로 저장.

### 2.4 단계 D — 김태웅 모집단 표시 (선택)

집계 단계(4) 에서 김태웅 21회 N=206 과 정확히 일치시키려면:

`All_확인완료_22th.xlsx` 에 **`excluded_from_kim`** 컬럼 추가 (Boolean):
- `true` — 김태웅 산업 수기 분류에서 제외하는 응답자
  - 예: R_Cate=etc 인데 R_Cate_Name 텍스트로도 산업 분류 불명확
  - 예: 거시지표는 응답했으나 다른 검수 사유로 분석 모수 제외
- `false` 또는 비어있음 — 김태웅 모집단에 포함

> 이 컬럼이 없으면 단계 4 자동 집계는 모든 응답자를 모집단으로 사용. 결과가 김태웅 21회와 N 차이 있을 수 있음.

### 2.5 단계 E — 5항목 응답 필터 (자동, 단계 4에서)

단계 4 의 자동 집계가 다음 5항목 모두 응답한 응답자만 사용:
- `R_Cate` (업종)
- `p1)R_1_2_2` (인원수)
- `p1)R_1_1_2` (매출액)
- `p1)R_1_5_2` (교육예산)
- `p1)R_2_n_2` (예산변동)

→ 단계 3 에서 이 5개 컬럼 결측값을 최소화하면 모집단 N 최대화. 결측 응답자는 `excluded_from_kim=true` 처리하면 명시적 제외.

---

## 3. 21회 정정 사례 (의사결정 참고)

### 3.1 매출 (p1)R_1_1_2) — 12건

| 패턴 | 사례 | 빈도 | 처리 |
|---|---|---:|---|
| 무응답 (raw=0) | "에스비아이저축은행 raw=0 → clean=854_900_000_000" | 6 | 응답자 확인 후 값 채움 |
| 단위 ×1억 보정 (4자리 이하 정수) | "raw=8549 → 854900000000 (8549억)" | 5 | 응답자가 "억원" 단위로 입력했다 판단 |
| 단위 ×1000 보정 | "raw=500_000_000 → 500_000_000_000" | 1 | 응답자가 "백만원" 단위로 입력 |

### 3.2 교육예산 (p1)R_1_5_2) — 9건

| 패턴 | 사례 | 빈도 | 처리 |
|---|---|---:|---|
| 무응답 (raw=0) | "차바이오텍 raw=0 → clean=20_000_000" | 5 | 응답자 확인 후 값 채움 |
| 단위 ×1억 보정 | "에스비아이저축은행 raw=7 → 700_000_000 (7억)" | 1 | 응답자가 억원 단위로 입력 |
| 단위 ×0.1 (자릿수 1개 추가) | "범진전자 raw=3_000_000_000 → 300_000_000" | 1 | 응답자가 0 하나 더 입력 |
| 단위 ×0.01 (자릿수 2개 추가) | "유진투자증권 raw=58_877_910_000 → 588_779_100" | 1 | 응답자가 ×100 오류 |
| 무효 처리 | "한국남부발전 raw=5 → 0" | 1 | 응답이 의미 불명 |

### 3.3 일반 판정 가이드

| 상황 | 판정 |
|---|---|
| 매출 < 1억 원 + 회사가 명확히 큰 규모 (인원수·예산 정상) | `fix` (×1억 단위 보정 의심) |
| 매출 1조 초과 + 회사가 중소 | `fix` (역단위 보정) |
| 교육예산 > 1000억 (1대기업 한도 초과) | `fix` (단위 의심) |
| 0 응답 + 응답자 전화 가능 | `request` 후 `fix` |
| 0 응답 + 다른 4지표도 0 | `invalid` (응답 불성실) |
| budget/revenue > 5% | `fix` (단위 의심, 사례 별로 판단) |
| budget > revenue (critical) | `fix` 또는 `invalid` (반드시 보정) |

---

## 4. 산출물 형식

### 4.1 `3_cleaned/All_확인완료_22th.xlsx`

**구조 — 21회 사본과 동일**:
- 시트 `Sheet1`: 응답 데이터 (raw_validated 와 같은 형식, 단 정정값 반영)
- 시트 `코드표`: 22회 codebook 사본 (`0_survey/codebook_22th.xlsx`)
- 시트 `HRD이슈_항목코드`: 22회 코드 사본

**추가 컬럼** (선택):
- `excluded_from_kim` (Boolean) — 단계 4 모집단 제어용

### 4.2 `3_cleaned/corrections_log.xlsx`

정정 이력. 매년 누적. 새 시트로 22회 정정 사례 추가.

| timestamp | company | col | raw | new | decision | rule_id | analyst | reason |

---

## 5. 검증 체크리스트 (분석가 자가 점검)

작업 완료 전 다음 확인:

- [ ] `outlier_report.xlsx` 의 모든 행에 `decision` 입력됨 (open 상태 0건)
- [ ] critical severity (budget > revenue 등) 0건 또는 모두 `fix`/`invalid` 처리
- [ ] `corrections_log.xlsx` 에 모든 `fix` 정정 기록됨
- [ ] `All_확인완료_22th.xlsx` 의 Sheet1 행 수 = raw_validated 와 동일 (행 삭제 아닌 셀값 변경만)
- [ ] 5핵심 항목 (R_Cate, 인원수, 매출, 예산, 예산변동) 응답률 확인
- [ ] `excluded_from_kim` 컬럼 추가 여부 결정 (김태웅 모집단 일치 원하면 true)

---

## 6. 다음 단계 트리거

작업 완료 시:
1. `progress.yaml` 의 단계 3 deliverables 상태 갱신:
   ```
   cleaning_manual: completed
   cleaned_db: completed
   corrections_log: completed
   ```
2. `python scripts/update_dashboard.py` 실행 (대시보드 갱신)
3. `python scripts/add_worklog.py --stage 3 --type deliverable --title "정제 DB 작성 완료" --artifacts "3_cleaned/All_확인완료_22th.xlsx,3_cleaned/corrections_log.xlsx"`
4. 단계 4 (자동 집계) 가동:
   ```
   python scripts/stage4_build_kim_xlsx.py \
       --src 3_cleaned/All_확인완료_22th.xlsx \
       --out 4_aggregated/김태웅_22th.xlsx
   ```

---

## 7. 자주 묻는 질문

**Q. outlier_report 의 false positive 가 많다 — 모두 검토해야 하나요?**
A. severity 별로 우선순위: `critical` > `high` > `medium`. critical 은 반드시 처리. medium 은 시간 여유 시 검토.

**Q. 응답자에게 확인 못 받은 경우는?**
A. `decision = request` 로 두고 다음 단계로 진행. 단계 4 자동 집계는 5항목 응답자만 사용하므로 무응답은 자연 제외됨.

**Q. 21회와 다른 새 정정 패턴 발견 시?**
A. `config/correction_patterns.yaml` 의 `matrix_22th` 섹션에 추가. 다음 회차 (23회) 에 학습 자료로 사용.

**Q. 단위 보정인지 응답 그대로인지 모호한 경우?**
A. `decision = request` + 응답자 후속 확인. 시간이 부족하면 `keep` 으로 보수적 처리 (영향 최소화).

**Q. 단계 4 결과가 김태웅 21회 수치와 다르면?**
A. (1) `excluded_from_kim` 컬럼으로 모집단 조정 (2) 산업 분류는 R_Cate 코드 + R_Cate_Name 텍스트 기반 분석가 수기 영역 — 단계 4 v2 도구가 보조 예정 (현재 미구현).
