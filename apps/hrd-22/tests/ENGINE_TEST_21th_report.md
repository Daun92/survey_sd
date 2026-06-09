# 정제·집계 CLI 엔진 시험 결과 (21회 데이터)

> 작성: 2026-05-20 · 입력: 21회 cleaned 305행(`reference/21th_cleaned.xlsx`)
> 목적: 22회 raw 도착(6월) 전, 김태웅 버전 핵심 엔진을 실데이터로 동작 검증.
> 범위: CLI 엔진 / cleaned(305) / 도구 동작 위주 (계획: `~/.claude/plans/raw-sharded-spindle.md`)

## 빌드한 엔진

| 산출물 | 역할 |
|---|---|
| `config/round_var_map_21_22.yaml` | 21↔22 변수명 매핑(외부화) |
| `scripts/round_adapter.py` | 21회 데이터 → 22회 이름 변환 |
| `scripts/curation_engine.py` | ingest / dedup / apply (결정 원장 적용) |
| `scripts/stage4_extract_chart_data.py` | 도표 데이터 집계 (응답방식 자동추론) |
| `config/decisions_21th.yaml` | 시험용 합성 결정 |
| 수정 `config/chart_specs.yaml` | 거시지표 primary_var/formula + top3_only |

## 실행 결과

```
round_adapter:  305×237 → 305×247
  · 중복 .1 컬럼 drop 1 (R_1_5_2.1)
  · 21회 native R_9_1_*(공공직급별, 22회 삭제) drop 6
  · 22회 신규 결손 17 (메타PII + AI비율 R_13_multi·p5 R_8/R_11)
curation_engine ingest: org_key 고유 295 (중복 조직 10행 초과)
curation_engine dedup:  중복 조직 9그룹/19행, 검토플래그 3그룹(R_Div 불일치)
curation_engine apply:  결정 3건, exclusion 1, 멱등성 OK
stage4_build_kim:       모집단 236, 7시트
stage4_extract_chart:   모집단 303, 도표데이터 108개 (skip 4)
```

## 검증 (pytest 25건 전부 통과)

**라운드 어댑터**: 컬럼 중복 0 / 충돌 rename 값 보존(R_5_1_2→R_7_1_2, R_7_1_2→R_11_1_2) / 22회 신규(R_13_multi·R_11_multi) 결손 확인 / native R_9_1_* 6개 drop.

**curation_engine**: 멱등성(2회==1회) / exclusion·reclassification·correction 정확 적용 / dedup 8+그룹·검토플래그 3.

**집계기**: 응답방식→agg 분류 13케이스(특히 `1~5점 척도`→likert가 `1=`enum→dist보다 우선) / size_tier roll-up 합=전체(299이하 124+300-999 104+1000이상 75=303) / dist 합≈100 / unknown agg 0.

**거시지표 단일변수·파생식**:
- 매출 1.53조 / 교육예산 4.85억 / 집행 3.94억
- 매출대비 교육비 **1.42%** (formula 집행/매출)
- 1인당 교육비 **89.7만원** (formula 집행/교육대상)

**김태웅 대조 sanity (±5pp)**: 인력규모 분포 — 본 엔진(236모수) 19.5/20.8/15.7/19.1/25.0% vs 김태웅(206) 18.4/18.9/17.0/16.5/29.1% → 전 구간 ±5pp 이내. (305≠206이라 빈도 불일치는 정상)

## 알려진 한계 (22회 적용 시 처리)

1. **mean_pct 합 >100 가능**: 합계 100%인 비율 묶음을 컬럼별 독립 평균하면 분모 차이로 합이 100을 벗어남(예: 교육형태 인원비율 합 121). 표시 단계에서 정규화 또는 동일분모 평균 필요.
2. **공공 모집단**: stage4 김태웅(segments.yaml)은 R_Cate 필수라 공공 제외(공공조직 시트 N=0). 집계기는 직원수 기준 모집단이라 공공 포함(65). 두 모집단 정의 통일 필요 — 정제 필터 합의 사항.
3. **major_industry**: 21회 시험은 `ref_21th` 8개 고정. 22회는 정제·재분류 확정 후 ≥10 재계산.
4. **거시지표 primary_var**: 도표3·5·6·7만 지정. 나머지 묶음 도표는 22회 본가동 전 보강.

## 다음 단계
- FastAPI+HTMX UI (엔진 위 얇은 층) — 본 엔진을 그대로 호출
- 정제 필터 5계층 합의(모집단 정의 통일 §한계2)
- 22회 raw 도착 시: round_adapter 불필요(이미 22회 이름), 동일 엔진 즉시 가동
