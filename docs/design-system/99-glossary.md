# 99. 용어 사전 (Living)

> **핵심 원칙.** 같은 용어를 사람마다 다르게 쓰면 디자인 시스템은 무너진다. 새 용어가 등장하면 여기에 먼저 올리고, 다른 문서는 첫 등장 시 `[용어](./99-glossary.md#anchor)` 로 링크한다.

## A

### Accessibility First
신규 기능의 "완료 정의"에 접근성(WCAG AA) 이 포함된다는 원칙. 나중에 덧붙이지 않는다. → [08-accessibility.md](./08-accessibility.md).

### arbitrary value
Tailwind 에서 `px-[13px]`, `bg-[#006a3c]` 처럼 토큰을 우회한 즉석 값. 원칙상 금지. → [02-tokens.md](./02-tokens.md).

## C

### CVA (class-variance-authority)
shadcn/Base UI 기반 컴포넌트의 variant 정의 라이브러리. 사용 예: `src/components/ui/button.tsx:8-43`.

### CompletionScreen
설문 응답 완료·재접속 완료를 보여주는 공용 패턴. 현재 `/s`, `/d` 에서 중복 구현, `03-components.md` 에서 단일 컴포넌트로 승격 대상.

### CUJ (Critical User Journey)
핵심 사용자 여정. PRD 의 필수 섹션. → [09-prd-framework.md](./09-prd-framework.md).

## D

### Design as Code
디자인 결정을 코드(토큰·컴포넌트·lint 규칙)로 표현한다는 TDS 원칙. → [01-principles.md](./01-principles.md) §A2.

### Deprecated 경로
Prisma 기반 `(dashboard)/*`, `/survey/[token]`, `/respond/[token]`, `/api/respond/*`, `/api/surveys/*`, `/api/distributions/*` (cs-bridge 제외), `/api/reports/*`. 이 디자인 시스템은 이 경로를 직접 수정하지 않는다.

## E

### 엄지영역 (Thumb zone)
한 손으로 폰을 쥘 때 엄지가 자연스럽게 닿는 하단 1/3. 응답자 경로의 핵심 CTA 가 놓여야 할 영역. → [04-respondent-ux.md](./04-respondent-ux.md).

### `.expert-theme`
응답자 페이지 전용 CSS 스코프. 초록 계열 Material 3 기반 토큰 26개 정의 (`src/app/globals.css:120-151`).

## I

### Invisible Design
AI·추천·자동화로 UI 질문 자체를 없애는 원티드의 원칙. → [07-ai-patterns.md](./07-ai-patterns.md).

## L

### Living Document
변경 이력을 누적 기록하며 진화하는 문서. 이 디자인 시스템 전체가 Living Document 다.

### Likert preset
만족도·동의·빈도·중요도 등 리커트 문항의 라벨 묶음. 현재 `src/app/s/[token]/survey-form.tsx:95-101`. 메시지 카탈로그로 이관 대상 (`06-ux-writing.md`).

## M

### MoSCoW
Must / Should / Could / Won't 우선순위 구분. 모든 로드맵 표에 적용. → [09-prd-framework.md](./09-prd-framework.md).

### 마이크로태스크 (Micro-task)
큰 입력 폼을 3~7 단계로 쪼개 각 단계를 독립 완료시키는 설계. 원티드 이력서 UX 원형. → [04-respondent-ux.md](./04-respondent-ux.md).

## O

### oklch
CIE L\*a\*b\* 계열 색공간. `src/app/globals.css` 의 모든 primitive 토큰이 이 단위로 정의됨. 명도(L) 기준 대비 계산이 쉬움.

### Optimistic UI
서버 응답을 기다리지 않고 성공을 가정해 UI 를 먼저 갱신하는 패턴. React 19 `useOptimistic` 활용. → [04-respondent-ux.md](./04-respondent-ux.md).

## P

### primitive token
가공되지 않은 색·spacing·radius 값 (예: `--primary: oklch(0.205 0 0)`).

### semantic token
의도 중심 토큰 (예: `--color-action-primary`). primitive 를 참조.

### component token
특정 컴포넌트 전용 토큰 (예: `--button-destructive-bg`). semantic 을 참조.

### pattern
primitive 와 composite 컴포넌트를 조합해 반복 UX 흐름을 구현한 단위. `CompletionScreen`, `EmptyState`, `ErrorBoundaryFallback` 등. → [03-components.md](./03-components.md).

### Progressive Enhancement
primitive → semantic → component → pattern 순서로 쌓아 올리는 시스템 확장 전략.

## R

### RFC
Request For Comments. 토큰·컴포넌트 신규 제안 문서. 템플릿: `_templates/token-change.md`, `_templates/component-spec.md`.

## S

### safe-area-inset
iOS 노치·홈 인디케이터 여백을 피하기 위한 CSS 환경 변수 (`env(safe-area-inset-bottom)` 등).

### semantic 색 역할
`action-primary`, `action-destructive`, `surface-success-subtle`, `surface-danger-subtle`, `text-muted` 등 의도 명명.

### SSOT (Single Source of Truth)
디자인 결정의 유일한 출처. 이 폴더(`docs/design-system/`).

### Suspense boundary
React 19 의 비동기 경계. loading.tsx / error.tsx 와 함께 쓴다. 현재 실사용 경로에 거의 없음.

## T

### TDS (Toss Design System)
토스의 디자인 시스템. 본 문서군의 최대 참조원.

### Thumb zone
→ 엄지영역.

## U

### UX Writing
UI 안의 모든 한국어/영어 문자열을 다루는 분과. 카피 라이팅·에러 메시지·빈 상태·CTA 를 포괄. → [06-ux-writing.md](./06-ux-writing.md).

## W

### WCAG AA
Web Content Accessibility Guidelines 2.1 Level AA. 색 대비 4.5:1 (본문) 기준. → [08-accessibility.md](./08-accessibility.md).

## 관련 문서

- 상류: [00-overview.md](./00-overview.md)
- 하류: 전 문서에서 역참조

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | 33개 용어 등록 |
