# 세그먼트별 분석 리포트 (HTML) — 기획 문서 (22회)

> 작성: 2026-05-29 · 상태: **기획(미구현)** · 실행: 별도 새 세션
> 선행 산출물: 발표용 deck(`5_report/preview/deck_22th_20260528.html`, 14장) — 본 리포트는 그 디자인 시스템을 재사용한다.

---

## 1. 목적 — 왜 세그먼트 리포트인가

현재 deck/스크롤 보고서는 **전체(기업 모집단) 단일 관점**의 집계다. 분석가·고객은 그 위에 "**어느 집단이 전체와 다른가**"를 본다 — 21회 김태웅 워크북이 바로 그 역할(16시트, 세그먼트별 동일 문항 재집계)이었다.

이 리포트의 한 줄 정의:
> **같은 문항 세트를, 세그먼트별로 다시 집계하고, '전체 대비 차이'를 강조해 보여주는 HTML.**

deck = "전체 스토리 1벌", 세그먼트 리포트 = "세그먼트 × 핵심지표 매트릭스 + 벤치마크".

---

## 2. 세그먼트 정의 — 21회 김태웅 → 22회 재생성

### 2.1 21회 김태웅 워크북 (참조 원본 `reference/21th_kim.xlsx`, 16시트)

```
전체
업종(10): 전자 · 자동차 · 에너지 · 패션 · 의료 · 금융 · IT · 교육 · 기업기타 · 공공조직
인력규모(5): 100미만 · 100-300 · 300-500 · 500-1000 · 1000이상
```

각 시트 = 한 세그먼트의 응답 부분집합 + 동일 문항 재집계. (공공은 21회에선 "업종 중 하나"로 혼합.)

### 2.2 22회로 재생성할 세그먼트 (변경점 반영)

| 축 | 22회 세그먼트 | 정의 근거 | 21회 대비 |
|---|---|---|---|
| 전체 | 전체(기업) | `segments.yaml` corporate 모집단 (R_Div 1·2·3) | 동일 |
| 인력규모 | 100미만 / 100-300 / 300-500 / 500-1000 / 1000이상 | `segments.yaml` id=2 bins | 동일 |
| 조직형태 | **공공조직 (별도)** | `POPULATION_FILTER_SPEC_22th` — 공공(R_Div 4·5) 별도 집계 | **신규 분리** (21회는 업종 혼합) |
| 업종 | 주요 업종 개별 + 소수 roll-up | `segments.yaml` id=1 (13업종+기업기타), `chart_specs.yaml` major_industry 규칙 | 22회 업종 목록·N에 맞춰 재선정 |

**업종 세그먼트 선정 규칙** (`chart_specs.yaml` segment_defs 기준):
- 재분류 확정 후 **카운트 ≥ 10** 인 업종만 개별 시트.
- N < 10 업종 → **기업기타**로 roll-up (`POPULATION_FILTER_SPEC` L5).
- 21회는 결과적으로 8~10개 업종이 개별. 22회는 실수집 분포에 따라 재선정(고정 아님).

### 2.3 ⚠ 업종 세그먼트의 선결 조건 (중요)

업종(R_Cate)은 `etc` 응답을 **분석가가 수기 재분류**해야 정확해진다(worklog id=9·16, deferred). 따라서:
- **인력규모·공공·전체 세그먼트** = 데이터만 있으면 즉시 안정적 생성 가능 → **프레임워크를 지금 설계**.
- **업종 세그먼트** = 수집 종료 + 수기 재분류 후 N≥10 확정 시 활성화. prelim 단계에선 raw R_Cate 기준 + "재분류 전" caveat, 또는 비활성.

---

## 3. 세그먼트별 분석 내용 (각 세그먼트가 보여줄 것)

deck의 핵심지표(= `compute_page_data`의 p4~p16)를 세그먼트로 재계산한다. 세그먼트 성격에 따라 강조 항목이 다르다.

| 지표 | 출처(deck) | 세그먼트 관점 |
|---|---|---|
| 응답 N · 구성 | p4 | 세그먼트 규모, (업종세그→규모믹스 / 규모세그→업종믹스) |
| 거시지표 (매출·인원·예산·집행, 매출대비교육비, 1인당) | p5 | 세그먼트 평균/중앙값 vs 전체 |
| 예산 변동 (확대/유사/축소) | p6 | 세그먼트 증감 방향 |
| 교육 형태별 참가·지출 | p9 | 세그먼트 교육형태 믹스 |
| 직책별 교육비 | p10 | 세그먼트 배분 구조 |
| AI 교육 비율 | p11 | 세그먼트 AI 도입 정도 |
| 만족도 | p12 | 세그먼트 체감 |
| AI 전략·CEO / AI 도입·예산 | p15·p16 | 세그먼트 AI 성숙도 |

**핵심 부가가치 = 벤치마크.** 각 세그먼트 카드에 "**전체 대비 ±차이**"를 병기(예: "AI 예산 확대 82% — 전체 74% 대비 +8%p"). 세그먼트 리포트의 존재 이유.

---

## 4. HTML 리포트 구조 (3가지 포맷 후보)

| 후보 | 형태 | 장점 | 단점 |
|---|---|---|---|
| **A. 스크롤 + 좌측 세그먼트 nav** | `result_*.html` 톤. 좌측에 세그먼트 목록, 본문에 세그먼트별 섹션 | 전체 훑기·인쇄 쉬움, 비교 한눈 | 길어짐 |
| **B. 세그먼트 = 챕터 deck** | 발표 deck처럼 세그먼트별 슬라이드 묶음 | 발표 그대로 활용 | 세그먼트 多 시 장수 폭증 |
| **C. 매트릭스 대시보드** | 행=세그먼트, 열=핵심지표 KPI 그리드 + 드릴다운 | 비교 최적 | 구현 복잡 |

권장: **A(스크롤+nav)를 기본**, 각 세그먼트 섹션 안에서 deck의 디자인 시스템 컴포넌트(KPI 카드·중앙 발산·likert·Sankey·heatstrip) 재사용 + 전체 대비 델타 배지. (C의 "매트릭스 요약"을 리포트 첫 화면에 얹는 하이브리드도 검토.)

### 디자인 시스템 재사용
deck(`stage5_render_deck.py`)에 이미 구축된 컴포넌트를 그대로 가져온다:
- KPI 카드 / 중앙 발산형(`.divergent`) / Likert(`.likert`,`.likert-mini`) / 히트스트립 / Sankey 알루비얼 / 방사형 요약 / T1~T4 비중.
- 토큰·팔레트(EXC green + AI violet)·Pretendard 동일.

---

## 5. 데이터 흐름·구현 접근

```
2_validated/raw_validated.xlsx
        │  (세그먼트 마스크: segments.yaml + R_Div/규모/업종)
        ▼
[세그먼트별 df] → compute_page_data(df_seg)  ← stage5_render_html.py 재사용
        │            (+ 전체 df 의 PAGE_DATA = 벤치마크)
        ▼
세그먼트별 PAGE_DATA dict + 델타  →  render (deck 디자인 시스템 컴포넌트)
        ▼
5_report/preview/segment_report_22th_YYYYMMDD.html
```

핵심 재사용 자산:
- `scripts/stage5_render_html.py` — `compute_page_data(df)` 를 **세그먼트 df 로 호출**하면 그대로 세그먼트 집계가 나온다(가장 큰 재사용 포인트).
- `scripts/stage4_extract_chart_data.py` — 이미 `build_population` + `segment_masks`(R_Div 분기, size_tier roll-up) 보유 → 세그먼트 마스크 로직 재활용.
- `config/segments.yaml` — 구간·라벨·모집단 정의.
- `config/chart_specs.yaml` — major_industry 선정·roll-up 규칙.
- `scripts/stage5_render_deck.py` — CSS 컴포넌트 + JS 빌더(차트 렌더).

신규 산출물(예): `scripts/stage5_render_segment_report.py` (세그먼트 루프 + 컴포넌트 조립).

---

## 6. 결정 필요 사항 (새 세션 착수 시)

1. **리포트 포맷** — A(스크롤+nav) / B(챕터 deck) / C(매트릭스) / 하이브리드. → 권장 A+매트릭스 요약.
2. **벤치마크 표시 방식** — 전체 대비 ±%p 배지 / 미니 비교 바 / 양쪽 병치. → 권장 ±%p 배지.
3. **세그먼트 범위 (1차)** — 인력규모 5 + 공공 + 전체만(데이터 안정) vs 업종 포함(재분류 의존). → 권장 1차=규모·공공·전체, 업종은 2차.
4. **소표본 처리** — N < k(예: 10) 세그먼트는 차트 숨김 + "표본 부족" 표기 (prelim 오해 방지). k 값 합의.
5. **지표 범위** — deck 전 지표 / 세그먼트 변별력 높은 핵심 5~6개. → 권장 핵심 우선 + 부록 전체.
6. **산출 시점** — 프레임워크(규모·공공)만 지금 vs 데이터 수집 종료 후 일괄. → [[workflow-design-first-data-second]] 패턴 권장(구조 먼저, 실데이터·업종은 후속).

---

## 7. 작업 단계 (할 일 단위)

1. **세그먼트 마스크 모듈 정리** → 확인: `segments.yaml` + `stage4` 마스크로 규모/공공/전체 df 분리, 각 N 출력.
2. **세그먼트별 집계 검증** → 확인: 각 세그먼트 df 로 `compute_page_data` 호출, 합산이 전체와 정합(N·비율).
3. **벤치마크(전체 대비 델타) 계산기** → 확인: 세그먼트 KPI − 전체 KPI 가 배지 텍스트로 산출.
4. **리포트 HTML 생성기 골격** (포맷 결정 반영) → 확인: 1개 세그먼트 섹션이 deck 컴포넌트로 렌더.
5. **전 세그먼트 루프 + 좌측 nav/요약 매트릭스** → 확인: 규모5+공공+전체 전 섹션 생성, 소표본 caveat 동작.
6. **업종 세그먼트 (2차, 재분류 후)** → 확인: N≥10 업종 자동 선정 + 기업기타 roll-up.
7. **캡처 검토 → 사용자 피드백 → 미세 조정** (deck 정비와 동일 이터레이션).

각 단계 산출 후 캡처→피드백 (사용자 선호 패턴).

---

## 8. 참고 파일·명령

- 21회 원본(정답지): `reference/21th_kim.xlsx` (16시트)
- 22회 프로토타입(7시트, 업종 미생성): `5_report/preview/kim_prototype_22th_20260528.xlsx`
- 생성기: `scripts/stage4_build_kim_xlsx.py` (xlsx) · `scripts/stage5_render_html.py`(`compute_page_data`)
- 세그먼트 정의: `config/segments.yaml` · 선정규칙: `config/chart_specs.yaml`
- 모집단 분리 명세: `docs/POPULATION_FILTER_SPEC_22th.md` (기업/공공)
- 세그먼트 규칙 검증: `docs/SEGMENT_RULE_VERIFICATION_21th.md`
- deck 디자인 시스템: `scripts/stage5_render_deck.py` (CSS 컴포넌트 + JS 빌더)

```bash
# 세그먼트 시트 구조 확인
PYTHONIOENCODING=utf-8 python -c "import pandas as pd; print(pd.ExcelFile('reference/21th_kim.xlsx').sheet_names)"
# 세그먼트 df 집계 시작점
python -c "import sys; sys.path.insert(0,'scripts'); import pandas as pd; from stage5_render_html import compute_page_data; df=pd.read_excel('2_validated/raw_validated.xlsx',dtype=object); print(compute_page_data(df).keys())"
```

> 새 세션 진입 프롬프트: "docs/SEGMENT_REPORT_PLAN_22th.md 기준으로 세그먼트 리포트 착수 — §6 결정사항부터 확인."
