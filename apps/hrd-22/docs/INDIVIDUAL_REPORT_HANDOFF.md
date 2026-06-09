# 개별 응답자별 벤치마크 리포트 — 새 프로젝트 Handoff

> 작성 2026-06-01 · 자체완결 문서. 이전 세그먼트 분석 자산을 재사용한다.
> 진입 프롬프트: **"개별 응답자별 벤치마크 리포트 프로젝트 시작. 각 완료 응답자(N=50)를 전체 평균 + 동일 세그먼트와 비교하는 개인 리포트 생성. docs/INDIVIDUAL_REPORT_HANDOFF.md 참조."**

## 0. 한 줄 목표
완료 응답자 **한 명 한 명**에게, 본인의 응답을 **(a) 전체 평균** 과 **(b) 동일 세그먼트(같은 규모군/업종)** 와 비교해 보여주는 개인 벤치마크 리포트를 생성한다. (예: "귀사 1인당 교육비 38만원 — 전체 +6만원, 동일 규모군 −2만원")

## 1. 핵심 재사용 자산 (대부분 이미 있음)
| 용도 | 자산 | 재사용 포인트 |
|---|---|---|
| 전 문항 집계 | `scripts/segment_aggregate.py` `aggregate_segment(df, questions, cb)` | **1행 df 를 넣으면 그 응답자의 값**이 같은 구조로 나옴. 전체·세그먼트도 동일 호출 → 셋을 비교 |
| 벤치마크 델타 | `stage5_render_segment_report.py` `fmt_delta`·`render_bench_strip`·`render_bench_oneline`·`HEADLINE` | "값 ±%p vs 기준" 패턴 그대로. 기준만 전체→(전체·동일군) 으로 확장 |
| 세그먼트 귀속 | `stage5_render_segment_report.py` `build_segments` / `config/segments.yaml` | 응답자의 규모구간·기업/공공 판정 로직 |
| 디자인 시스템 | `scripts/design_tokens.py TOKENS_CSS` + 정적 렌더러(`_pct_bars`·`_cf_bars`·`_kpi_cards`·`_likert_rows`·`_iv_pairs`) | 개인 리포트 UI 그대로. 규격 `docs/CHART_FONT_SPEC_22th.md` |
| 입력 | `2_validated/raw_validated.xlsx` (완료 50, **각 행 = 1 응답자**) | 식별: `R_Name`·`R_Company_Name`·`R_Position`·`tesmi_target`(이메일)·`recommend` |

## 2. 비교 로직 (agg 유형별 — 설계 주의)
응답자 1행에 `aggregate_segment` 를 돌리면 agg 별로 의미가 다름:
- **mean / macro / tenure_ym / mean_pct / mean_pct_cf**: 개인값 = 그 값. 평균/세그먼트값과 **수치 델타**(가장 깔끔, 핵심).
- **likert / likert_iv**: 개인 점수 vs 평균 점수 델타.
- **dist / multi_rate / issue_rank / issue_multi**: 개인은 **단일 선택**(분포 100% on 본인 응답). → "귀사 선택: X / 동일군 X 선택률 Y%" 형태로 프레이밍(델타 아님).
→ 개인 리포트는 **mean·likert 계열(델타가 자연스러운 핵심지표) 위주** 권장. dist/multi 는 "내 선택 + 또래 비중" 표기.

## 3. 결정 필요 (다음 세션 시작 시 분석가 확인)
1. **비교 축**: 전체만 / 전체+동일규모 / 전체+동일규모+동일업종(업종은 재분류 후). → 기본 권장: **전체 + 동일 규모군**(업종은 재분류 후 추가).
2. **지표 범위**: 핵심(HEADLINE 7 + 1단계 교육시간·증감이유) 위주 vs 전 문항. → 개인 리포트는 **핵심 위주 + 본인 응답 요약** 권장(간결).
3. **산출 형태**: 응답자별 개별 HTML 50개 / 단일 파일 분기 / PDF(배포용). 배포 경로(이메일 `tesmi_target`?).
4. **식별·PII**: 개인 리포트는 본인 식별정보 포함(회사·이름). **외부 발송 시 보안·동의 확인 필요**. 파일명/저장 위치 PII 주의.
5. **소표본 주의**: 동일 규모군 N<10 (현 5구간 다수 N≈9–10) → 비교 잠정. prelim 배너 + 표본수 표기.

## 4. 제안 단계 (할 일 단위)
1. **비교 데이터 빌더** (신규 `scripts/stage7_individual_data.py` 등): 응답자 행 → 본인 aggregate + 전체 aggregate + 귀속 세그먼트 aggregate → `{qid: {me, overall, seg, delta_overall, delta_seg}}`. ③ 집계기 3회 호출 재사용.
2. **개인 리포트 렌더러**: 식별 헤더(회사·규모군·업종) + 핵심지표 카드(내 값 + vs전체/vs동일군 델타 배지) + 선택 문항 "내 응답 vs 또래 비중". 디자인 토큰·정적 렌더러 재사용.
3. **일괄 생성**: 완료 50명(또는 선택) 반복 → `5_report/individual/<회사_or_id>.html`. 미응답 필드 graceful.
4. **검증**: 한 응답자 수기 대조(본인값·델타 정합), 브라우저 렌더·PII 노출 점검.

## 5. 함정·주의
- **1행 aggregate 의 dist/multi**: 분모 1이라 "분포"가 아니라 "본인 선택". 위 §2 대로 분기.
- **세그먼트 귀속**: 직원수 결측 응답자는 규모군 미배정 → 전체 비교만. 공공은 공공끼리.
- **델타 방향 의미**: 만족도(1=긍정)·교육비 등 지표별 "높을수록 좋음" 방향 주석 필요(오해 방지).
- **데이터 자동 갱신**: 매일 07:00 N 증가 → 생성 시점 N 표기. 수집 종료(9월) 후 최종본.
- 재사용 규격: 색·폰트·차트는 `docs/CHART_FONT_SPEC_22th.md` 토큰만. raw hex 금지.
