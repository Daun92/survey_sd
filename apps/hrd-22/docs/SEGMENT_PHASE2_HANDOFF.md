# 세그먼트 분석 2단계 — 새 세션 Handoff (②~⑤)

> ✅ **완료 (2026-05-29)**: ②~⑤ 전부 구현·검증 완료. 산출 = `4_aggregated/김태웅_22th.xlsx`(7시트×54문항) + `5_report/preview/segment_report_22th_20260529.html`(54문항 핵심/부록 + 업종 placeholder).
> 신규: `scripts/segment_aggregate.py`(범용 집계기, 12 agg). config `segment_items_22th.yaml` verify 전건 해소(54문항). 업종은 `segments.yaml industry.enabled:true` 전환 시 ④⑤ 자동 활성(현재 비활성 — R_Cate 재분류 게이트).
> 남은 후속(이 단계 범위 밖): 업종 수기 재분류 → enabled:true · prelim N=44 → 수집종료(9월) 후 재계산 · 분석가 확인 2건(hrd_staff 분리·edu_content 저성과자 합산, 기본값 진행).
>
> 아래는 구현 당시 가이드(이력 보존). 함께 읽을 것: `docs/SEGMENT_FULL_ITEMS_SPEC_22th.md`, `config/segment_items_22th.yaml`.

---

## 0. 한 줄 목표
22회 세그먼트 분석을 **2026 설문 전체(약 45문항) × (전체·규모5·공공·업종) 데이터수준**으로 확장. 산출물 둘: **XLSX(전 문항 종합)** + **HTML(핵심/부록 + 업종)**.

## 1. 현재 위치
- **①단계 완료**: 문항 인벤토리 `config/segment_items_22th.yaml` 작성됨(45문항: `id·page·title·cols·agg·html(핵심/부록)·kim21`, 일부 `verify:true`).
- **②~⑤ 대기**(전부 Python 실행 필요): ②컬럼 검증 → ③범용 집계기 → ④XLSX 전문항 → ⑤HTML 핵심/부록 + 업종 프레임워크.
- 데이터는 매일 자동 갱신(작업 스케줄러 `HRD22_daily`, 현재 N=48 완료). `2_validated/raw_validated.xlsx` 가 입력.

## 2. 확정된 결정 (재론 불요)
1. 포맷 = 스크롤 + 좌측 nav + 요약 매트릭스(HTML). 벤치마크 = 전체 대비 ±%p 배지(녹/적 현행 유지).
2. 세그먼트 축 = 전체 + 규모5(100미만/100-300/300-500/500-1000/1000이상) + 공공 + **업종(재분류 후 N≥10)**.
3. 항목 = **2026 설문 전체**(21회 kim xlsx 아님). 21회는 **라벨 병기(주석)만**. 22회 native 라벨 채택 → 직책자→리더십·영업+CS·신입+경력 병합은 데이터 결정 불요.
4. 산출물 = **둘 다**. XLSX=전 문항(html!=제외). HTML=핵심만 본문 + 부록 접기.
5. 업종 = 수기 재분류 후 정식(프레임워크는 지금, 데이터는 재분류 후 자동 활성). R_Cate etc/미분류 ~33% 가 게이트.
6. 소표본 N<10 = 프레임엔 전부 렌더+prelim 배너, 산출 시 숨김(k=10).

## 3. 핵심 파일·자산
| 용도 | 파일 |
|---|---|
| 문항 인벤토리(①) | `config/segment_items_22th.yaml` |
| 2026 기준 스펙 | `docs/SEGMENT_FULL_ITEMS_SPEC_22th.md` |
| 22회 정답지(컬럼·응답형식·라벨) | `0_survey/codebook_22th.xlsx` 시트 `코드표`[컬럼코드·Part·설문문항·하위항목·응답형식·21회_매핑], `HRD이슈_항목코드` |
| 집계 엔진(재사용) | `scripts/stage4_extract_chart_data.py` (`agg_value`·`build_population`·`segment_masks`·`num`·`_dist`·`_multi_rate`·`_mean_pct`) |
| 데이터·HTML 렌더(재사용) | `scripts/stage5_render_html.py` (`compute_page_data`·`render_chart_body`·`freq_dist`·`multi_dist`·CSS·JS_TEMPLATE) |
| deck 디자인 시스템(정본) | `scripts/stage5_render_deck.py` (`CSS`·`JS`·initP4~16·renderLikertMini·horizontalBar100) |
| 현 HTML 세그 리포트 | `scripts/stage5_render_segment_report.py` |
| XLSX 김태웅 생성기 | `scripts/stage4_build_kim_xlsx.py` (`apply_sheet_filter`·`compute_group_freq`·`write_sheet`·`build_pop`) |
| 세그먼트 정의 | `config/segments.yaml` (sheets 7개; 업종 sheets 추가 대상) |
| 21회 원본(레이아웃 참조) | `reference/21th_kim.xlsx` (16시트=전체+9업종+공공+5규모) |
| 입력 데이터 | `2_validated/raw_validated.xlsx` (자동 갱신) |

## 4. 단계별 실행 가이드

### ② 컬럼 검증 (verify 플래그 해소) — 먼저
`config/segment_items_22th.yaml` 의 `verify:true`(Ⅱ·Ⅲ·Ⅳ)와 와일드카드(`p2)R_10_*`, `p3)R_1_*`, `p4)R_*`)를 코드북 실제 컬럼으로 확정.
- 검증 스크립트: 코드북 `코드표`에서 `설문문항` 그룹별 `컬럼코드` 추출 → config `cols` 채우기. raw_validated 컬럼에 모두 존재하는지 확인.
- 누락/와일드카드 점검 1-liner:
  `python -c "import pandas as pd,yaml; c=yaml.safe_load(open('config/segment_items_22th.yaml',encoding='utf-8')); r=set(pd.read_excel('2_validated/raw_validated.xlsx',dtype=object).columns); print([(q['id'],x) for q in c['questions'] for x in q['cols'] if '*' not in x and x not in r] or 'OK'); [print(q['id'],x,len([z for z in r if str(z).startswith(x.replace('*',''))])) for q in c['questions'] for x in q['cols'] if '*' in x]"`
- **코드북 quirk**: `1.교육내용`(p3)R_1)에 **저성과자 중복**(p3)R_1_7 & _9) → dedupe. 현재/향후 = `_3`/`_4` 접미. 중요도/수행도도 `_3`/`_4` (문항별 확인).
- 완료 확인: 모든 cols 가 실제 컬럼, verify 플래그 제거.

### ③ 범용 집계기 `scripts/segment_aggregate.py` (신규)
- `aggregate_segment(df_seg, questions) -> {qid: {...}}`. 세그먼트 df + config 문항 → 전 문항 집계값.
- `stage4_extract_chart_data.agg_value`/`num`/`_dist`/`_multi_rate`/`_mean_pct` + `stage5_render_html.freq_dist`/`multi_dist` 재사용.
- **신규 agg 3종 구현**: `mean_pct_cf`(현재/향후 쌍 → 현재·향후 각각 항목별 평균%), `dist_multi`(다항목 각각 단일선택 분포 — 예 제도현황 13제도 실시율), `likert_iv`(중요도/수행도 쌍 mean+분포).
- 라벨: config 에 두지 말고 **코드북에서 런타임 도출**(dist/multi=응답형식 `n=라벨` 파싱, mean_pct/likert=하위항목).
- 확인: 전체 df 로 호출 → Ⅰ 항목이 기존 `compute_page_data` 결과와 일치(정합 sanity), 신규 항목 값이 합리적.

### ④ XLSX 전문항 — `stage4_build_kim_xlsx.py` 확장
- 현재: segments.yaml `column_groups`(5 인구통계)만 `compute_group_freq`로. → **확장**: 세그먼트 시트마다 ③집계기로 45문항 전부를 행 블록으로.
- 세그먼트: segments.yaml sheets(전체·규모5·공공) + 업종(재분류 후). 레이아웃은 `reference/21th_kim.xlsx`(항목=열/행 교차표) 참조하되 22회 항목으로.
- 확인: `4_aggregated/김태웅_22th.xlsx` 전 시트에 45문항 집계, N 정합.

### ⑤ HTML 핵심/부록 + 업종 — `stage5_render_segment_report.py` 확장
- ③집계기로 데이터 산출. **핵심**(config html==핵심): 현 핵심6 + 1단계3 + Ⅴ AI(R_5 대상·R_6 분야·R_7 기대성과·R_11 향후) + Ⅲ 교육내용·교육형태. **부록**(접기): Ⅱ 전반·Ⅲ 세부·Ⅳ·Ⅴ 나머지(R_3·R_8·R_9) + 현 부록(p4·p9·p10).
- 렌더: deck 컴포넌트 재사용 + multi_rate 는 기존 `_reason_bars`(1단계) 패턴 또는 deck `horizontalBar100`. 신규 차트는 정적 HTML 우선(빌드시점 데이터).
- **업종 프레임워크**: `config/segments.yaml`에 업종 sheets(major_industry, N≥10 자동) + `stage4 segment_masks.major_industry` 연동 + `build_segments`가 업종 세그먼트를 (재분류 decisions 있으면) 자동 포함. 재분류 전엔 업종 섹션 비활성/placeholder.
- 확인(브라우저): 중복 ID 0, 차트 렌더, 핵심/부록 토글, 창 resize 정상.

## 5. 반드시 알 함정 (이번 세션에서 확인)
- **deck 스택이 정본**: `stage5_render_html.py`의 JS_TEMPLATE은 p9/p10/p11에서 markup과 불일치(stale). HTML 세그 리포트는 **deck CSS+JS**를 import해 세그먼트별 `buildSegment(PAGE_DATA, NS)` 팩토리 + `getElementById(`→`getElementById(NS+` 치환, 마크업 `id="`→`id="{ns}` 로 ID 네임스페이스(기존 파일 무수정).
- **deck CSS `html,body{overflow:hidden}`**(슬라이드용) 상속 주의 → EXTRA_CSS에서 `overflow:visible` 덮어씀(안 하면 스크롤 막힘).
- **ECharts**: 스크롤 맥락에선 명시 높이 필요 + resize 핸들러(`_resizeAllCharts`) 필수. deck 여백/폰트가 슬라이드폭 기준이라 **1열 풀폭**. `.likert-score-grid` 등 슬라이드 기준 큰 폰트는 `.chart-block` 스코프로 축소 override(안 하면 프레임 이탈).
- **앵커 점프**: 즉시(scroll-margin-top), 긴 문서에 smooth 금지.
- **round_var_map_21_22.yaml 은 구버전 — 무시.** 코드북 `코드표`가 22회 정답지.
- **설문 직접 확인**: `research.exc.co.kr/RAC/survey/view/hrd_2026/{1~5}` view 모드는 게이트 없이 문항 렌더(Playwright). 데이터/설문정의 API는 내부 ID 접근.
- **데이터 자동 갱신**: 매일 07:00 `HRD22_daily`(fetch_raw→stage2→재생성). `fetch_raw.py` 의 `tesmi_status` 코드→라벨 매핑(0=설문중,10=완료) 주의.
- 업종 게이트: R_Cate etc(18)/미분류(19) 수기 재분류(curation) 선행 → N≥10 업종 확정.

## 6. 새 세션 진입 프롬프트
> "docs/SEGMENT_PHASE2_HANDOFF.md 기준으로 세그먼트 분석 2단계 ②부터 진행. ②config 컬럼 검증(verify 해소) → ③범용 집계기 → ④XLSX 전문항 → ⑤HTML 핵심/부록 + 업종 프레임워크. config/segment_items_22th.yaml·docs/SEGMENT_FULL_ITEMS_SPEC_22th.md 참조."
