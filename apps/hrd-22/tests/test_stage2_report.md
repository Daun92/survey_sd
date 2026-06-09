# 단계 2 이상치 플래그 — 21회 reverse-run 검증

**Recall (정정 사례가 자동 플래그됨)**: 19/21 (90%)

**KPI 해석**: 21회 raw 에서 분석가가 단위 보정한 21건이 자동 이상치 플래그에 모두 포함되는가?

## 정정 케이스별 recall

| 회사 | 컬럼 | raw | clean | 플래그 | 적용된 규칙 |
|---|---|---:|---:|:---:|---|
| 현진스포텍 | p1)R_1_1_2 | 2.00e+07 | 2.06e+11 | ✓ | 매출_단위의심_과소,budget_exceeds_revenue,ratio_budget_vs_revenue,emp_revenue_mismatch |
| 교보리얼코 | p1)R_1_1_2 | 1160 | 1.16e+11 | ✓ | 매출_단위의심_과소,budget_exceeds_revenue,ratio_budget_vs_revenue,emp_revenue_mismatch |
| 리뉴어스 | p1)R_1_1_2 | 0 | 3.72e+11 | ✓ | 매출_무응답,many_zeros |
| 남양넥스모 | p1)R_1_1_2 | 5.00e+08 | 5.00e+11 | ✓ | emp_revenue_mismatch |
| 비보존제약 | p1)R_1_1_2 | 870 | 8.76e+10 | ✓ | 매출_단위의심_과소,budget_exceeds_revenue,ratio_budget_vs_revenue,emp_revenue_mismatch |
| 한성자동차/조정우 | p1)R_1_1_2 | 0 | 2.80e+12 | ✓ | 매출_무응답,budget_exceeds_revenue |
| 에스비아이저축은행 | p1)R_1_1_2 | 8549 | 8.55e+11 | ✓ | 매출_단위의심_과소,emp_revenue_mismatch |
| 인천공항시설관리 | p1)R_1_1_2 | 0 | 3.16e+11 | ✓ | 매출_무응답,budget_exceeds_revenue |
| 재세능원 | p1)R_1_1_2 | 0 | 1.41e+11 | ✓ | 매출_무응답,budget_exceeds_revenue |
| 디알비동일 | p1)R_1_1_2 | 7526 | 7.53e+11 | ✓ | 매출_단위의심_과소,budget_exceeds_revenue,ratio_budget_vs_revenue,emp_revenue_mismatch |
| KATRI시험연구원 | p1)R_1_1_2 | 0 | 6.63e+10 | ✓ | 매출_무응답,many_zeros |
| 대한사료 | p1)R_1_1_2 | 0 | 5.07e+11 | ✓ | 매출_무응답,budget_exceeds_revenue |
| 차바이오텍 | p1)R_1_5_2 | 0 | 2.00e+07 | ✓ | 교육예산_무응답,many_zeros |
| 범진전자 | p1)R_1_5_2 | 3.00e+09 | 3.00e+08 | ✗ |  |
| 리뉴어스 | p1)R_1_5_2 | 0 | 2.00e+08 | ✓ | 교육예산_무응답,many_zeros |
| 한국남부발전 | p1)R_1_5_2 | 5 | 0 | ✓ | 교육예산_단위의심_과소 |
| 남양넥스모 | p1)R_1_5_2 | 0 | 1.00e+08 | ✓ | 교육예산_무응답 |
| 대한제당 | p1)R_1_5_2 | 0 | 1.50e+08 | ✓ | 교육예산_무응답 |
| 에스비아이저축은행 | p1)R_1_5_2 | 7 | 7.00e+08 | ✓ | 교육예산_단위의심_과소 |
| 유진투자증권 | p1)R_1_5_2 | 5.89e+10 | 5.89e+08 | ✗ |  |
| 메디인병원 | p1)R_1_5_2 | 0 | 3.20e+07 | ✓ | 교육예산_무응답 |

## 미감지 케이스 분석

- **범진전자** (p1)R_1_5_2): raw=3.00e+09 → clean=3.00e+08
  - 예산 범위 내 (100만~1000억) — 규칙 미적용
- **유진투자증권** (p1)R_1_5_2): raw=5.89e+10 → clean=5.89e+08
  - 예산 범위 내 (100만~1000억) — 규칙 미적용