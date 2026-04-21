# survey_sd Design System — 개요

> **핵심 원칙.** 이 디자인 시스템은 *시각적 통일성* 이전에 **응답자·관리자가 겪는 본질적 문제 해결**을 위해 존재한다. "예뻐 보이는 화면"보다 "상식적으로 편한 흐름"이 먼저다 (토스 Simplicity, 원티드 Invisible Design).

## 1. 이 문서 묶음은 무엇인가

survey_sd 가 실사용 경로(`/admin/*`, `/s/[token]`, `/d/[token]`, `/hrd/[token]`)에서 일관된 UX·UI·카피·접근성·프로세스를 제공하도록 만드는 **설계 제안서**다. 코드 변경은 포함하지 않는다. 각 문서는 현상 진단 → 설계 원칙 → Before/After → 로드맵 → 수용지표 → 체크리스트 순서를 따른다.

철학적 출처는 두 갈래다.

- **토스(TDS)** — Simplicity as Code, Accessibility First, UX 라이팅 내재화, 점진적 향상(Progressive Enhancement), AI-Native.
- **원티드** — 마이크로태스크 기반 입력, 엄지영역(Thumb zone), 인지부하 최소화, Invisible Design(탐색→추천), 미니멀 시각언어.

이 두 축에 PRD 실무(문제정의, 귀납·연역·가추, MoSCoW, 엣지케이스, Living Document) 를 얹어 **기획·디자인·개발·QA 공통 SSOT** 를 세운다.

## 2. 왜 지금인가 — 현상 3줄 진단

1. **토큰 미준수.** `src/app/admin/**` 실사용 페이지에서 `bg-teal-600`·`bg-emerald-100`·`px-[13px]` 같은 하드코딩 색·arbitrary spacing 이 **30개 파일·466건** (2026-04-21 기준 `rg` 집계)에 달한다. semantic 토큰(`src/app/globals.css:51-84` 의 oklch 변수)이 있지만 실제 소비처가 따라가지 못한다.
2. **컴포넌트 중복과 UX 공백.** 응답자 완료 화면이 `src/app/s/[token]/page.tsx:43-55` 와 `src/app/d/[token]/page.tsx:62-98` 에서 두 번 구현됐고, `loading.tsx`·`error.tsx`·Suspense·skeleton·`useOptimistic` 는 실사용 경로에 거의 없다.
3. **라이팅·문서가 산재.** "설문이 종료되었습니다" 같은 카피가 각 컴포넌트에 박혀 있으며, 디자인 결정을 기록한 Living Document 가 없다.

## 3. 문서 맵

| # | 파일 | 해결하려는 문제 |
|---|---|---|
| 01 | [01-principles.md](./01-principles.md) | TDS × 원티드 철학을 survey_sd 도메인 원칙으로 번역 |
| 02 | [02-tokens.md](./02-tokens.md) | oklch 토큰 3계층화 (primitive → semantic → component) |
| 03 | [03-components.md](./03-components.md) | CVA 규약, 중복 제거(CompletionScreen), pattern 등급 |
| 04 | [04-respondent-ux.md](./04-respondent-ux.md) | `/s`, `/d`, `/hrd` 모바일·엄지영역·자동저장·safe-area |
| 05 | [05-admin-ux.md](./05-admin-ux.md) | `/admin/*` 하드코딩 색 치환·빈상태·다이얼로그 일관화 |
| 06 | [06-ux-writing.md](./06-ux-writing.md) | 한국어 카피 상수화·톤·에러·빈상태·CTA 라이팅 |
| 07 | [07-ai-patterns.md](./07-ai-patterns.md) | `/api/ai/*` 스트리밍 UX·Invisible Design·신뢰 표식 |
| 08 | [08-accessibility.md](./08-accessibility.md) | WCAG AA·키보드·aria·reduced-motion·자동 검증 |
| 09 | [09-prd-framework.md](./09-prd-framework.md) | `docs/prd/` 템플릿·MoSCoW·엣지케이스·Living Document |
| 10 | [10-roadmap.md](./10-roadmap.md) | Phase 1/2/3 간트·의존성·수용지표 집계 |
| 99 | [99-glossary.md](./99-glossary.md) | 용어·토큰명 사전 (Living) |

**템플릿** — `_templates/component-spec.md`, `_templates/token-change.md`, `_templates/prd.md`.

## 4. 라우팅 제1원칙 (반드시 지킬 것)

> [!WARNING]
> 이 디자인 시스템은 **실사용 경로만** 대상이다: `/admin/*`, `/s/[token]`, `/d/[token]`, `/hrd/[token]`.
> Deprecated 경로 `(dashboard)/*`, `/survey`, `/respond`, `/api/respond/*`, `/api/surveys/*`, `/api/distributions/*` (cs-bridge 제외), `/api/reports/*` 는 **touch 하지 않는다**.
> 공용 레이어(`src/components/ui/*`, `src/app/globals.css`)가 개선되면 deprecated 경로도 파생 이득을 받지만, 그쪽을 *직접 수정*하는 지침은 어느 문서에도 넣지 않는다.

Before/After 인용은 언제나 실사용 경로 파일만 사용한다. 모든 문서 말미의 `## 관련 문서` 아래 "라우팅 스코프: 실사용만" footer 를 유지한다. 근거와 전체 매핑은 [AGENTS.md](../../AGENTS.md) 의 "라우팅 제1원칙" 섹션.

## 5. Living Document 규칙

- **단일 진실 공급원(SSOT)**: 디자인 결정은 이 폴더에만 기록한다. 타 문서(`docs/PRD.md`, 개별 컴포넌트 상단 JSDoc)는 포인터만 둔다.
- **RFC 프로세스**: 신규 토큰은 `_templates/token-change.md`, 신규 컴포넌트/패턴은 `_templates/component-spec.md` 로 제안한 뒤 해당 문서(02·03)에 병합한다.
- **용어 변경**: 새로운 용어는 `99-glossary.md` 먼저 업데이트 → 다른 문서 본문에서 해당 용어 첫 등장 시 `[용어](./99-glossary.md#term)` 링크.
- **Change Log**: 각 문서 하단에 `## 변경 이력` 을 두고 `YYYY-MM-DD | 주제 | PR` 형태로 누적 기록.
- **진입 점검**: PR 리뷰어는 디자인/UX 변경이 이 문서군과 정합하는지 먼저 확인한다.

## 6. 기여 흐름

1. 변경할 축을 고른다 (토큰/컴포넌트/응답자 UX/관리자 UX/라이팅/AI/접근성/PRD).
2. 해당 문서의 `## Before / After` 에 현상 1건을 추가한다 (파일:라인 인용 필수).
3. 템플릿(`_templates/*.md`)을 복사해 RFC 초안 작성 → 리뷰 → 병합.
4. 수용지표(`## 수용지표`)가 어떻게 움직이는지 `10-roadmap.md` 의 Phase 표에 반영한다.
5. 실행 단계에서 PR 본문에 이 문서 섹션 링크를 첨부한다.

## 7. 빠른 포인터

- 색/타이포/spacing 정의 → `01-principles.md` §Do/Don't, `02-tokens.md`.
- 버튼·카드·다이얼로그를 어떻게 써야 하나 → `03-components.md`.
- `/s`, `/d` 모바일 공백 → `04-respondent-ux.md`.
- 한국어 카피 어디에 둘까 → `06-ux-writing.md`.
- AI 로딩·스트리밍 UX → `07-ai-patterns.md`.
- PRD 를 어떻게 쓰나 → `09-prd-framework.md` + `_templates/prd.md`.
- 용어 모르겠으면 → `99-glossary.md`.

## 관련 문서

- 상류: [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md)
- 하류: 01 ~ 10, 99, `_templates/*`

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | Phase 0 — 설계 제안서 세트 도입 |
