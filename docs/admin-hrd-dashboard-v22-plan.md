# 22회 인적자원개발 실태조사 — 관리자 대시보드 정보구조 (v2 기획안)

> 작성: 2026-05-14
> 상태: **기획 초안** — 다음 세션에서 의사결정 9건 확정 후 구현 진입
> 컨텍스트: `/admin/hrd/dashboard` (현 8KB), `/admin/hrd/statistics` (PR #138·#140 적용)

---

## 0. 왜 새 기획인가

현 통계 페이지(4 카드)는 회차 진행 점검에 필요한 의미를 충분히 주지 못한다.

| 현재 카드 | 산식 | 21회 실측 | 의미 |
|---|---|---|---|
| 총 응답 수 | `COUNT(*) hrd_responses` | 48,504 | 데이터 적재량 — **응답률로 정규화 안 됨** |
| 응답자 수 | `COUNT DISTINCT respondent_id` | 303 | OK |
| 문항 수 | `COUNT DISTINCT item_id` | 223 | OK (2개는 응답 0건) |
| **평균 점수** | `AVG(value_number)` 전체 | **125억** | **단위 무시한 산술평균 — currency 909건이 결과 지배. 의미 사실상 없음** |

22회는 곧 응답 수집이 시작될 회차(`status='draft'` → `collecting`). 22회 시작 시점에 관리자가 **결정 가능한 정보**가 일관되게 드러나도록 정보구조를 새로 짠다.

---

## 1. 대시보드가 답해야 할 질문

대시보드는 "관리자가 매일/매주 열어볼 때 어떤 의사결정을 돕느냐"로 정렬한다.

| Q | 누가/언제 묻는가 | 우선 |
|---|---|---|
| Q1. 수집이 목표 대비 어디까지 왔나? | 매일, 책임자 | 최상 |
| Q2. 어떤 조직 유형이 미응답인가 (재독려 대상)? | 주 1~2회, 운영자 | 상 |
| Q3. 응답 품질은 괜찮은가 (완료율·평균 소요시간)? | 1~2회, 운영자 | 상 |
| Q4. 22회 핵심 변화(AI Part V 신규)에서 어떤 답이 모이는가? | 수집 후반, 분석가 | 중 |
| Q5. 21회 같은 시점 대비 어떤가 (대시 시계열)? | 주간 회의용 | 중 |
| Q6. 깊은 분석은 어디서 하나? | 분석가 | 항상 (링크) |

---

## 2. 정보구조 (섹션 6개)

### 헤더 — 회차 정체성·진행 상태
- 22회 / 2026 / `collecting` 배지 + `starts_at` / `ends_at` / D-day
- 좌측 사이드바에 "회차 전환" (21·22 토글) — `?round=21` URL 동기화
- 우측 상단 액션: `[설계 →]` `[전체 통계 →]` `[응답자 관리 →]` (기존 라우트로 점프)

### A. 수집 KPI (4 카드) — Q1·Q3
| 카드 | 산식 |
|---|---|
| 목표 대비 응답률 | `completed_n / target_count` (target=300) + 진행 막대 |
| 완료자 수 | `respondents WHERE status='completed'` |
| 진행 중 / 초대됨 | `in_progress` + `invited` 분리 표기 |
| 평균 응답 소요시간 | `AVG(completed_at - started_at)` (분 단위) — 진행 중 응답자가 얼마 걸렸는지 |

### B. 응답자 분포 (도표 3개) — Q2
| 도표 | 데이터 |
|---|---|
| 조직 유형 도넛 | `org_type_code` 5종 분포 (대기업·중기업·소기업·공공·학교) |
| 업종 가로 막대 | `industry_code` 14종 분포 |
| 일별 완료 추세 | `completed_at::date` group by — 최근 30일 line |

### C. 응답 품질 (2 카드 + 표) — Q3
| 위젯 | 산식·내용 |
|---|---|
| 평균 응답률(문항) | `responses_n / (completed_n × items_n)` — 응답자 1명이 평균 몇 % 문항을 채우는가 |
| 응답 0건 문항 수 | `items_n - unique_items_with_response` — 아무도 답 안 한 문항 |
| 미응답 응답자 표 | `status='invited'` 응답자 list (재독려 대상) |

### D. 22회 핵심 변화 잠정 분포 — Q4 (v0.2 신규 항목 강조)
- AI 도입 단계 (`p5)R_4_multi`) — 5 옵션 분포 (도넛)
- AI 교육 만족도 / 현업활용도 (`p5)R_8_1_3`, `R_8_2_3`) — 5점 척도 평균 + 분포
- 향후 AI 교육 내용 (`p5)R_11_multi`) — 멀티 옵션 분포
- 교육비 중 AI 비율 (`p1)R_11_multi`) — 6 옵션 분포

### E. 21회 baseline 비교 (조건부) — Q5
- 22회 응답이 일정 수 (예: 30+) 이상이면 자동 활성
- 비교 메트릭 (likert 평균, 핵심 비율) 4~6개를 **델타 화살표** (▲ ▼) 로 표시
- "전년 같은 시점 응답" 비교는 시점 매칭 어려우니 v1 에선 보류 — closed 21 데이터로 단순 비교

### F. 깊은 분석 진입점 — Q6
- `/admin/hrd/statistics` 링크 카드 (224 items distribution)
- `/admin/hrd/respondents` (개별 응답자 보기)
- `/admin/hrd/consulting` (AI 컨설팅 리포트 — 후속)

---

## 3. 데이터 소스 / 신규 RPC 후보

### 재사용
- `get_hrd_round_statistics(round_id)` — 단 `avg_score` 는 v2 에서 deprecate 또는 likert 전용으로 redefine
- `get_hrd_part_statistics(round_id)` — 그대로
- `get_hrd_item_distribution(round_id, item_id)` — PR #138 결과

### 신설 후보
| RPC 이름 | 입력 | 출력 | 용도 |
|---|---|---|---|
| `get_hrd_collection_kpi(round_id)` | uuid | jsonb (target/completed/in_progress/invited/avg_minutes) | A 섹션 |
| `get_hrd_respondent_breakdown_v2(round_id)` | uuid | SETOF (org_type, count) + (industry, count) | B 섹션 |
| `get_hrd_daily_completed(round_id, days)` | uuid, int | SETOF (date, count) | B 일별 추세 |
| `get_hrd_response_quality(round_id)` | uuid | jsonb (avg_completion_rate, zero_response_items) | C 섹션 |
| `get_hrd_round_compare(a_round, b_round, item_ids[])` | uuid×2, uuid[] | SETOF (item_id, a_mean, b_mean, delta) | E 섹션 |

**기존 `get_hrd_round_statistics` 변경**: `avg_score` → `likert_avg` (only `answer_type='likert_5'`). 또는 컬럼 보존 + 새 컬럼 `likert_avg` 추가 (호환성). 본 PR(머지 전) 의 design 결정 사항.

---

## 4. 의사결정 체크리스트 (9건)

다음 세션에서 합의 받은 뒤 구현 진입.

| # | 결정 항목 | 옵션 | 권장 |
|---|---|---|---|
| D-1 | 회차 전환 UX | URL `?round=N` 토글 / 사이드바 dropdown / 헤더 select | URL 동기화 + 헤더 dropdown |
| D-2 | `avg_score` 처리 | (a) likert_avg 로 재정의 (b) 신규 컬럼 추가 (c) deprecate 후 제거 | (b) 호환 유지 + 신규 컬럼 |
| D-3 | A 섹션 "응답 소요시간" 포함 여부 | 포함 / 별도 위젯 / 제외 | 포함 (분 단위) |
| D-4 | 일별 추세 기간 | 7일 / 30일 / 회차 전체 | 30일 |
| D-5 | E 섹션 활성 임계치 | 22회 응답 30 / 50 / 100 명 이상 | 50명 |
| D-6 | 21vs22 비교 항목 (E) | 핵심 5개 / 핵심 10개 / 전체 likert | 핵심 5개 (사용자 지정) |
| D-7 | D 섹션 (AI 신규) 위치 | 상단 강조 / 일반 항목 / 별도 페이지 | 일반 항목 (D 섹션 그대로) |
| D-8 | 실시간 갱신 vs 캐시 | revalidate 60s / on-demand / `hrd_benchmark_cache` | revalidate 60s |
| D-9 | 권한 — 운영자/관리자 구분 | 동일 / 응답자 목록만 분리 / 전체 분리 | 동일 (v1) |

---

## 5. 구현 단계 (다음 세션)

| Phase | 작업 | 분량 |
|---|---|---|
| **P1** | RPC 5개 신설 (마이그레이션 1) + `get_hrd_round_statistics` 호환 redefine | 1~2 시간 |
| **P2** | `/admin/hrd/dashboard/page.tsx` 전면 재작성 + 신규 컴포넌트 (A·B·C·D·E·F) | 4~6 시간 |
| **P3** | 차트 컴포넌트 — donut, hbar, line (재사용 `src/components/charts/` 또는 신규) | 2~3 시간 |
| **P4** | E2E playwright 스모크 (응답 0/30/300 케이스) | 1~2 시간 |
| **P5** | Draft PR → 사용자 시각 검증 → ready·merge | — |

---

## 6. 비고 / 알려진 제약

- **22회 v0.2 patched codebook 의존**: AI 섹션 D 의 신규 item code (`p5)R_8_1_3` 등) 가 22회 DB 에 존재 — PR #139 (round 21 baseline) 와 무관하게 round 22 reseed 시 이미 반영
- **21회 데이터 제약**: 5종 ORG_TYPE 분포 / 14종 industry 분포 모두 들어가있음 (PR #139 검증). v0.1 AI 섹션 (4·5·6·7·8·9·10번) 만 있고 22회 v0.2 신규(R_8_1_3 등) 는 21회엔 없음 → D 섹션은 22회 전용
- **응답 import 절차**: 22회는 실 응답 수집 시 자동 적재 (현재 응답 0). 21회는 일회성 `import_21th_all.py` 로 수동 적재
- **RLS**: 모든 RPC 는 `SECURITY DEFINER` + `authenticated` 권한. anon 차단

---

## 7. 다음 세션 시작 — Quick Resume

새 세션에서 이 문서로 진입하려면:

```
docs/admin-hrd-dashboard-v22-plan.md 읽고 §4 의사결정 9건 합의부터 시작.
완료되면 §5 P1 (RPC 마이그레이션) 진입.
```

또는 (의사결정 이미 완료 시):

```
docs/admin-hrd-dashboard-v22-plan.md §4 의 권장안 적용 + §5 P1 부터 구현.
```

---

## 부록 — 현재 자산 요약 (2026-05-14 기준)

- 머지된 PR: #135 (L1 자동화 로드맵) / #136 (T2 BRIS) / #137 (design 강화) / #138 (statistics distribution) / #139 (21회 baseline seed) / #140 (숫자 표기 fix)
- 21회 baseline: 303명 / 48,504 응답 / `closed`
- 22회: `draft` / 응답 0 / items 224 + parts 5 (v0.2 patched codebook 반영)
- 신규 RPC: `get_hrd_item_distribution` (PR #138)
- 미사용 카드: `평균 점수` (의미 없음 — D-2 결정 대상)
