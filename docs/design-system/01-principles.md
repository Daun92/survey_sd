# 01. 설계 원칙 — TDS × 원티드의 도메인 번역

> **핵심 원칙.** 사용자의 *물리적·인지적 마찰*을 시스템 내부로 흡수한다. 화면에 남는 것은 과업과 피드백뿐. 미학은 과업을 돕는 한에서만 허용된다.

## 현상 진단

현재 survey_sd 는 (a) 금융(토스)과 (b) 채용(원티드)과 달리 교육·HRD 설문이라는 도메인이지만, 겹치는 본질 문제가 있다.

- 응답자는 낯선 설문을 모바일로 3~5분 안에 끝내야 한다. 화면이 길고 CTA 가 애매하면 이탈한다.
- 관리자는 빌더·배포·리포트를 오가며 일 단위로 수십 번 같은 동작을 반복한다. 버튼/배지/색이 페이지마다 다르면 인지 부하가 누적된다.
- AI 가 문항·분석·리포트를 보조하지만, 로딩·실패 UX 가 약해 "살아 있는 도구"처럼 느껴지지 않는다.

이 문서는 위 문제를 **원칙** 으로 압축해, 02~09 문서가 일관되게 따르게 한다.

## 설계 원칙

### A. 토스 TDS 5원칙의 번역

1. **Simplicity as Problem-solving.** 화면을 줄이는 게 아니라 *질문의 당위성* 을 줄인다.
   - 예: 응답자 `name`·`department` 입력은 배포 경로로 추론 가능하면 생략한다 (`src/app/s/[token]/survey-form.tsx:73-76` 의 `DEFAULT_RESPONDENT_FIELDS`).
2. **Design as Code.** 색·spacing·radius 는 Tailwind arbitrary value 가 아닌 토큰(`src/app/globals.css:51-84`)으로만 표현한다. 위반은 lint 로 막는다.
3. **Accessibility First.** 신규 컴포넌트는 WCAG AA 대비·키보드 포커스·aria 이름을 "구현 완료 정의"의 일부로 넣는다. 나중에 덧붙이지 않는다.
4. **Progressive Enhancement.** primitive 토큰 → semantic 토큰 → component 토큰 순서로 추가한다. 상위를 먼저 만들지 않는다.
5. **UX Writing 내재화.** 카피는 컴포넌트에 하드코딩하지 않고 `src/messages/ko/*.ts` 카탈로그로 옮긴다 (`06-ux-writing.md`).

### B. 원티드 5원칙의 번역

1. **마이크로태스크 분할.** 설문은 섹션 단위(3~7문항)로 나누고 하단 고정 CTA 로 전환한다. 긴 스크롤 폼 지양.
2. **엄지영역.** 응답자 페이지의 핵심 CTA 는 하단 고정 + `env(safe-area-inset-bottom)` 적용 + 44×44 pt 이상.
3. **인지부하 최소화.** 같은 기능의 카드/배지/상태 색은 전체 앱에서 **한 셋트** 만 쓴다. `distribute-tabs.tsx:111-113` 처럼 페이지마다 재정의 금지.
4. **Invisible Design.** AI 로 대체 가능한 탐색(빌더에서 문항 제안, 리포트 코멘트, 응답 분석)은 UI 로 캐묻지 말고 배경에서 처리한다. 사용자는 결과만 본다.
5. **미니멀 시각언어.** 여백·타이포 위계로 정보 흐름을 만든다. 장식적 그라데이션·shadow 는 기본적으로 금지, 필요 시 `--shadow-*` 토큰으로만.

### C. survey_sd 도메인 제약

- **모바일 우선.** `/s`, `/d`, `/hrd` 는 80% 이상 모바일 트래픽을 가정한다. 데스크톱은 `max-w-[760px]` 고정폭으로 중앙 배치.
- **응답자 권한 없음.** 응답자는 재시도·저장·복구 같은 파워유저 기능이 없다. 상태 오류 시 다음 행동은 앱이 대신 고른다.
- **한국어 존댓말.** 응답자 카피는 항상 존댓말, 관리자 카피는 간결한 평서체. (자세한 톤은 `06-ux-writing.md`.)
- **차트·표의 신뢰감.** 리포트는 *숫자의 근거* 를 먼저 보여준다. 알록달록한 palette 대신 1 primary + muted 조합.

### D. 충돌 시 우선순위

1. 접근성(WCAG AA) >
2. 성능(p75 INP < 200ms, Lighthouse A11y ≥ 95) >
3. 일관성(토큰/컴포넌트 재사용) >
4. 미학(모션·일러스트·색조)

미학 때문에 위 세 가지를 양보하지 않는다.

## Do / Don't

| # | Do | Don't |
|---|---|---|
| 1 | `bg-primary` / `bg-[--color-action-primary]` 같이 semantic 토큰 사용 | `bg-teal-600`, `bg-emerald-100` 같은 raw palette 사용 |
| 2 | CTA 를 하단 고정 + safe-area 처리 | 긴 폼 상단에 "제출" 버튼을 두기 |
| 3 | 에러 카피에 *무슨 일·왜·다음 행동* 3요소 | "오류가 발생했습니다" 단문으로만 처리 (`src/app/error.tsx:18`) |
| 4 | 같은 의미의 완료 화면은 `CompletionScreen` 1개 컴포넌트 | `/s`, `/d`, `/hrd` 에서 각자 div 로 중복 구현 |
| 5 | AI 결과는 스트리밍 + 취소 + 재시도 | `fetch` 일괄 응답 + 스피너만 |
| 6 | 모션은 `prefers-reduced-motion` 분기 + 200ms 이하 | 과도한 fade/slide, 모바일 셀룰러에서 프레임 드롭 |
| 7 | 모든 문항·섹션·버튼에 `aria-label` 또는 의미 있는 텍스트 | 아이콘-only 버튼에 `aria-label` 누락 |
| 8 | `arbitrary value` 는 lint 로 막고 RFC 로 승격 | `px-[13px]`, `h-[37px]` 같이 즉석 값 남발 |

## 원칙 ↔ 문서 매핑

| 원칙 | 어디서 구현되나 |
|---|---|
| A1 Simplicity | `04`, `05`, `07` |
| A2 Design as Code | `02`, `03` |
| A3 A11y First | `08` (교차: 모든 문서) |
| A4 Progressive Enhancement | `02`, `03`, `10` |
| A5 UX Writing 내재화 | `06` |
| B1 마이크로태스크 | `04` |
| B2 엄지영역 | `04` |
| B3 인지부하 최소화 | `03`, `05` |
| B4 Invisible Design | `07` |
| B5 미니멀 시각언어 | `02`, `05` |
| C 도메인 제약 | 전 문서에서 재확인 |
| D 우선순위 | 분쟁 시 이 문서로 복귀 |

## 로드맵

| 항목 | M/S/C/W | Phase | 담당 문서 |
|---|---|---|---|
| 원칙 A~D 팀 합의·공표 | Must | P1 | 01 |
| Do/Don't 를 PR 템플릿 체크리스트로 이식 | Must | P1 | 01, 09 |
| 위반 1건당 이슈 발행 규약 | Should | P2 | 01, 10 |
| 디자인 리뷰 슬롯 (격주 30분) 수립 | Could | P2 | 10 |
| 외부 공개 (Public design memo) | Won't | — | — |

## 수용지표

**정량**
- PR 본문에 "A1~A5, B1~B5 중 어떤 원칙을 적용/변경했는가" 를 기재한 비율 ≥ 80% (Phase 2 말).
- Do/Don't 표에 기반한 자동 lint 규칙 ≥ 4개 적용.

**정성**
- 신규 팀원이 이 문서 한 장만 읽고 리뷰어 코멘트 성격을 예측할 수 있다.
- "왜 이렇게 했나요?" 질문에 토큰/컴포넌트 PR 담당자가 이 문서 섹션을 링크로 답할 수 있다.

## 체크리스트 (PR 직전 자가 확인)

- [ ] raw palette 색(`teal-`, `emerald-`, `amber-`, `stone-`, `rose-` 등)을 쓰지 않았다.
- [ ] arbitrary spacing(`px-[13px]` 등)을 쓰지 않았다.
- [ ] CTA 가 엄지영역 규칙을 충족한다 (응답자 경로에 한해).
- [ ] 카피 3요소(무슨 일·왜·다음 행동)를 지켰다.
- [ ] 컴포넌트를 새로 만들기 전에 `03-components.md` pattern 목록을 확인했다.
- [ ] 모션을 `prefers-reduced-motion` 에서 비활성화한다.
- [ ] AI 호출에는 취소·재시도·폴백이 있다.

## 관련 문서

- 상류: [00-overview.md](./00-overview.md)
- 하류: [02-tokens.md](./02-tokens.md), [03-components.md](./03-components.md), [04-respondent-ux.md](./04-respondent-ux.md), [05-admin-ux.md](./05-admin-ux.md), [06-ux-writing.md](./06-ux-writing.md), [07-ai-patterns.md](./07-ai-patterns.md), [08-accessibility.md](./08-accessibility.md), [10-roadmap.md](./10-roadmap.md)

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | 원칙 A~D 정의 |
