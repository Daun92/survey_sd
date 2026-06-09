# 차트 · 그래프 · 폰트 사용 규격 (22회)

> 작성 2026-05-29 · 4개 자산(deck·메인HTML·세그먼트 리포트·design-system 문서) 전수 인벤토리 기반.
> **정본 = `5_report/design-handoff/project/assets/exc-tokens.css`** (색·타입·간격·반경·모션 토큰) + 본 문서가 정의하는 **AI 테마·발산·Likert5·순위3** 확장.
> 코드 단일 소스 = `scripts/design_tokens.py`(`TOKENS_CSS`·`ECHARTS_PALETTE`). 모든 렌더러가 여기서 토큰을 가져온다.

---

## 0. 단일 소스 정책 (왜 흩어졌나 → 어떻게 모으나)

조사 결과 토큰이 **4곳에서 제각기 정의**되며 표류했다:
- `exc-tokens.css` (정본·완비) / `design-system.css`(`--ds-*` 접두 별개) / deck·html 인라인 `:root`(서로 다른 부분집합) / 세그먼트 raw hex.

**규칙:**
1. 색·타입·간격·반경·모션의 **유일한 정의처는 `scripts/design_tokens.py:TOKENS_CSS`** (값은 `exc-tokens.css`와 동일 + 확장). 렌더러는 인라인 `:root`를 두지 말고 `TOKENS_CSS`를 임베드한다.
2. ECharts(JS) 색은 별도 손정의 금지 — `design_tokens.py:ECHARTS_PALETTE`(동일 hex 파생)에서 생성한 `C` 객체만 사용.
3. `exc-tokens.css`(문서용)와 `TOKENS_CSS`(렌더러용)는 **같은 팔레트**를 유지(본 작업에서 AI/Likert/순위 토큰을 양쪽에 추가).
4. raw hex/rgba 직접값 금지 — 반드시 토큰 또는 `color-mix(... , var(--token) N%, white/transparent)`.

---

## 1. 색 토큰

### 1.1 브랜드 그린 램프 (`--exc-green-*`)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--exc-green-50` | #E6F5EE | 배경 틴트 |
| `--exc-green-200` | #8CD0AE | 보조·약positive |
| `--exc-green-300` | #4DBE89 | (= `--ds-mint`) |
| `--exc-green` | #009858 | **주색**(로고), positive |
| `--exc-green-600` | #007A46 | hover·강조 |
| `--exc-green-700` | #005E36 | 텍스트 강조·1순위 |

### 1.2 중립 (warm-grey)
`--exc-ink #111` · `--exc-ink-2 #333` · `--exc-muted #555` · `--exc-muted-2 #888` · `--exc-line #E5E7EB` · `--exc-line-2 #D1D5DB` · `--exc-panel #F7F8F9` · `--exc-panel-2 #EFF1F3` · `--exc-bg #FFFFFF`.
> **#fff 직접 사용 금지 → `--exc-bg`**. (현 deck·html·세그먼트가 #fff 하드코드)

### 1.3 의미 강조 (절제 사용)
`--exc-navy #0E2A47`(재무·신뢰) · `--exc-amber #F4B740`(신규·featured·경고) · `--exc-red #E94B35`(파괴·alert) · `--exc-info #2A6FDB`(본문 링크).

### 1.4 AI 테마 (22회 신설 영역 — Ⅴ AI, 신규 섹션)
`--ai-dusk #0E0E27` · `--ai-dusk-2 #161636`(어두운 배경) · `--ai-violet #5B5BF0` · `--ai-violet-2 #7C7CFF` · `--ai-cyan #00E5C8`.
> 규칙: **AI/신규 영역만** violet/cyan. 일반 본문은 green. (`--ds-violet`=`--ai-violet` 동일값 — 문서 `--ds-*`는 alias로만.)

### 1.5 발산 의미색 (positive ↔ negative) — 드리프트 정리
| 토큰 | 값 | 용도 |
|---|---|---|
| `--ds-mint` | #4DBE89 | 약positive (= green-300) |
| `--ds-rose` | #E94B6E | **negative**(Likert 부정, 하향 델타 막대) |
| `--ds-rose-700` | #B3324B | negative **텍스트**(밝은 배경 대비) — 기존 `#b3324b` 대체 |
> **빨강 3종 정리**: 발산 negative = `--ds-rose`(막대)/`--ds-rose-700`(텍스트). `--exc-red`는 alert 전용으로 분리. (기존: `--exc-red`·`--ds-rose`·`#b3324b` 혼용)

### 1.6 Likert 5단계 발산 스케일 (NEW · 4중 정의 통일)
점수축 **부정→긍정** 고정 팔레트. 데이터 매핑(어느 끝이 긍정인가)은 문항별로 결정.
| 토큰 | 값(파생) | 의미 |
|---|---|---|
| `--lk-1` | `var(--ds-rose)` | 강한 부정 |
| `--lk-2` | `color-mix(--ds-rose 50%, white)` | 약한 부정 |
| `--lk-3` | `var(--exc-line-2)` | 중립 |
| `--lk-4` | `var(--exc-green-200)` | 약한 긍정 |
| `--lk-5` | `var(--exc-green)` | 강한 긍정 |
> 통일 대상: 세그먼트 `#c44/#e89/#cbd/#8b9` · deck/html JS `LIKERT_5` · 문서 `color-mix`.
> **방향 주의**: 만족도(1=매우만족=긍정)처럼 1=긍정인 문항은 매핑을 뒤집어 사용(코드별 점수→lk 토큰 매핑은 문항 polarity 따라).

### 1.7 순위 3단계 (NEW · issue_rank)
`--rank-1 = var(--exc-green-700)` · `--rank-2 = var(--exc-green)` · `--rank-3 = var(--exc-green-200)`(기존 `#bcd6c4` 대체). 1순위가 가장 진함.

---

## 2. 타입 스케일

폰트 패밀리: `--font-sans`(Pretendard Variable) 본문/차트, `--font-mono`(데이터·코드). 웨이트 `--fw-regular 400 … --fw-black 900`, 라인하이트 `--lh-tight 1.1 / -snug 1.25 / -base 1.6 / -loose 1.75`.

### 2.1 리포트 스케일 (문서·스크롤 보고서 — `--fs-*` 정본)
화면 문서(메인HTML·세그먼트 리포트) 기준. **px 직접 지정 금지, 토큰 사용.**
| 토큰 | px | 용도 |
|---|---|---|
| `--fs-display` | 64 | 표지 대형 수치 |
| `--fs-h1` | 40 | 페이지 제목 |
| `--fs-h2` | 28 | 섹션 제목(세그먼트명) |
| `--fs-h3` | 22 | 블록 제목 |
| `--fs-h4` | 18 | 차트 제목 |
| `--fs-body-lg` | 18 | 리드 |
| `--fs-body` | 16 | 본문 |
| `--fs-body-sm` | 14 | 보조·축 라벨 |
| `--fs-caption` | 12 | 캡션·범례 |
| `--fs-micro` | 11 | **NEW** 데이터 밀집 표/막대 라벨(세그먼트 컴팩트) |
| `--fs-eyebrow` | 12 | eyebrow(uppercase) |
> 세그먼트 리포트의 11~13px 컴팩트 라벨 = `--fs-micro/-caption/-body-sm`로 매핑. (데이터 밀도 높은 스크롤 보고서의 의도된 축소 — 슬라이드와 별개)

### 2.2 슬라이드 스케일 (deck — 1920px 투사 매체, 별도)
deck는 다른 매체(프로젝션 1920px)이므로 **독립 스케일**. 리포트와 통일하지 않는다(투사 가독성).
| 슬롯 | px | 용도 |
|---|---|---|
| slide-display | 96~150 | 표지·디바이더 대형 수치 |
| slide-headline | 44 | 슬라이드 헤드라인(accent) |
| slide-kpi | 56~96 | KPI 타일 값 |
| slide-h | 28~38 | 소제목 |
| slide-body | 18~26 | 본문·인트로 |
| slide-chart | 18 | 차트 라벨(ECharts) |
| slide-caption | 14~15 | 캡션·footer |
> deck 폰트는 슬라이드 폭 기준 → 세그먼트 리포트에서 deck 컴포넌트 재사용 시 `.chart-block` 스코프로 축소 override 필요(기존 함정, [[segment-report-22th-status]]).

### 2.3 deck CSS 컴포넌트 재사용 시 필수 스코프 축소 (위반 = 결함)
보고서(`.chart-block`)에서 재사용하는 **deck CSS-HTML 컴포넌트는 전부** 슬라이드 폰트/레이아웃을 보고서 스케일로 축소해야 한다(`width:100%`만으로는 불충분). 대상·기준:
| 컴포넌트 | 슬라이드 원본 | 보고서 스코프(.chart-block) |
|---|---|---|
| `.heatstrip` (p11) | 라벨26·값34·셀60px·`space-evenly` | 라벨 `--fs-body-sm`·값 `--fs-h3`·셀26px·`flex-start`+gap |
| `.likert` 발산바 (p12) | 라벨26·바64·net34 | 라벨 `--fs-body-sm`·바30px·net `--fs-h3` |
| `.likert-score-grid` (p12) | 값60 | 값30·라벨13 (기존 적용) |
| `.likert-mini`·`.stack-with-surplus`·`.slope` | 슬라이드 폰트 | 보고서 폭에서 겹침·넘침 시 동일 패턴 적용 |
> **판정 기준(라벨 vs 값)**: 항목 **라벨·축**은 본문 스케일(≤`--fs-body` 16) 이하여야 한다. **KPI 값(큰 수치)**은 "수치가 메시지"이므로 제목보다 커도 **정상**(거시지표 48·만족도 30 등 — 규격 외 아님). **결함 = 라벨 과대 또는 레이아웃 겹침/넘침**(예: p11 heatstrip 라벨26px + 셀 세로 겹침).

---

## 3. 차트 · 그래프 패턴 카탈로그

선택 가이드 = 디자인 시스템 매트릭스(응답형태 × 표현의도, `5_report/design-handoff/project/design-system.html` §2, [[22th-design-system-matrix]]). 아래는 **현 코드 패턴 → 데이터형·색·기술 매핑**(정합 기준).

| 데이터형 | 패턴 | 기술 | 색 규칙 | 구현 |
|---|---|---|---|---|
| 단일선택 분포 | 도넛 / 세로바 | ECharts | green 계열, 강조 1색 | deck p4 |
| 단일선택 분포(스크롤) | 가로 진행률 막대 | CSS-HTML | `--exc-green-700`(dist) | 세그먼트 `_pct_bars(cls=dist)` |
| 중복선택 선택률 | 랭킹 가로바(정렬) | CSS-HTML | `--ai-dusk`(neu) | 세그먼트 `_pct_bars(cls=neu)` / deck `horizontalBar100` |
| 중복선택 순위 | 가중 순위 스택 | CSS-HTML | `--rank-1/2/3` | 세그먼트 `_issue_rank_rows` |
| 척도(Likert) | 발산 막대 / 분포 막대 | ECharts·CSS | `--lk-1…5` | deck p12·p15·p16, 세그먼트 `_likert_rows` |
| 척도 중요/수행 페어 | 페어 막대 | CSS-HTML | 중요=`--ai-violet`/수행=`--ai-dusk` | 세그먼트 `_iv_pairs` |
| 현재/향후 페어 | 페어 막대 | CSS-HTML | 현재=`--exc-muted-2`/향후=`--exc-green` | 세그먼트 `_cf_bars` |
| 단일 KPI | KPI 카드 | CSS-HTML | green-700 값 | 세그먼트 `_kpi_cards` |
| 추세 | 슬로프 | SVG | 상승green/하락rose/정체muted | deck p9 |
| 압축 분포 | 히트 스트립 | CSS grid | green 점진 | deck p11 |

> **같은 데이터형에 deck 컴포넌트 ↔ 세그먼트 정적 렌더러 병존** 시: deck(ECharts)는 슬라이드/핵심, 세그먼트 정적(CSS-HTML)은 스크롤 보고서. 둘 다 위 색 규칙을 따른다.

---

## 4. ECharts 규약

- **폰트**: `BASE_TEXT.fontFamily = var(--font-sans)` 값(Pretendard). 축 라벨 = 리포트 `--fs-caption(12)`~`--fs-body-sm(14)`, 슬라이드 18px. 제목 = `--fs-h4(18)`.
- **색**: `ECHARTS_PALETTE`(`design_tokens.py`)에서 생성한 `C` 객체만. 차트별 손색 금지.
- **그리드**: `commonGrid()` 사용(직접 left/right 값 금지). 가로 100% 누적은 `horizontalBar100()`.
- **반응형**: 스크롤 맥락은 `.chart-box` 명시 높이 + `_resizeAllCharts` 핸들러 필수(display:none→0×0 init 보정 포함).

---

## 5. 코드 정렬 체크리스트 (정본 어긋남 → 조치)

| # | 어긋남 | 위치 | 조치 |
|---|---|---|---|
| 1 | 인라인 `:root` 분기(deck≠html) | deck·html | `TOKENS_CSS` 임베드로 교체 |
| 2 | JS `C` 색객체 중복 | deck·html | `ECHARTS_PALETTE` 파생으로 교체 |
| 3 | `--ds-rose/--ds-mint` 미정의 참조 | html p12 legend | TOKENS_CSS에 정의(잠재버그 해소) |
| 4 | Likert raw hex `#c44/#e89/#cbd/#8b9` | 세그먼트 `.lk-seg` | `--lk-1…5` |
| 5 | 순위 raw hex `#bcd6c4` | 세그먼트 `.ir-seg.r3` | `--rank-3` |
| 6 | negative `#b3324b` | 세그먼트 `.delta.down`·`.rc-h.down` | `--ds-rose-700` |
| 7 | `#8a6300`(seg-tag) | 세그먼트 | `color-mix(--exc-amber, ink)` 토큰화 |
| 8 | `#fff` 하드코드 | 3개 전부 | `--exc-bg` |
| 9 | 컴팩트 폰트 raw px | 세그먼트 정적 렌더러 | `--fs-micro/-caption/-body-sm` |
| 10 | deck 타입 스케일 부재 | deck | 슬라이드 스케일 토큰 명문화(§2.2) |

### 적용 현황 (2026-05-29)
- ✅ **완료**: 단일 소스 `scripts/design_tokens.py` 구축 / deck·메인HTML·세그먼트 인라인 `:root` → `TOKENS_CSS` 교체 / `exc-tokens.css` 동기화(AI·발산·Likert·순위·micro 추가) / 세그먼트 raw hex(#1~9 중 4·5·6·8) 토큰화 / **잠재버그 2건 해소** — 세그먼트 `--radius/--shadow/--exc-green-700` 미정의(deck만 import해 폴백) + 메인HTML p12 `--ds-rose/--ds-mint` 미정의. 4개 렌더러 재빌드 + 브라우저 검증(라운딩 복원·색 해소·차트 정상) 완료.
- ✅ **§2.3 스코프 축소 보완(2026-05-29)**: p11 `heatstrip`(라벨26→`--fs-body-sm`·값34→`--fs-h3`·셀60→26px·`space-evenly`→`flex-start`로 **셀 세로 겹침 해소**) + p12 `likert` 발산바 스코프 축소. 전 차트블록 실측 → 보고서 폭 겹침·넘침 0. (score-grid 외 누락분 보완)
- ◻ **선택 잔여(값은 이미 일치, 거동 무영향)**: #2 JS `C` 색객체 → `ECHARTS_PALETTE` 파생 교체(현재 손정의 hex가 정본과 동일값) · #7 seg-tag `color-mix` 적용(완료) · deck 자체 `#000/#fff/rgba` 슬라이드 배경(매체 특성, 토큰화 저가치) · 세그먼트 컴팩트 폰트 px→`--fs-*` 스냅(off-scale 13/15/17 존재, 레이아웃 영향 검토 후).

[[22th-design-system-matrix]] · [[segment-report-22th-status]] · [[22th-deck-design-system-status]]
