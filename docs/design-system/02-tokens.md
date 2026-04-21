# 02. 디자인 토큰 — 3계층 모델

> **핵심 원칙.** 색·spacing·radius·shadow 를 primitive → semantic → component 3층으로 쌓는다. 컴포넌트는 **semantic 또는 component 토큰만 소비**하고, raw palette(`teal-*`, `emerald-*`…) 나 arbitrary value 를 직접 쓰지 않는다.

## 현상 진단

### 이미 있는 것

- `src/app/globals.css:51-84` — `:root` 에 oklch 기반 primitive 28개.
- `src/app/globals.css:86-118` — `.dark` 에 대응 override.
- `src/app/globals.css:120-151` — `.expert-theme` (응답자 전용 Material 3 스코프, 26개 변수).
- `src/app/globals.css:42-48` — `--radius` 배수 기반 `--radius-sm ... --radius-4xl`.
- `src/app/globals.css:7-49` — `@theme inline` 블록에서 Tailwind 에 노출.

### 문제점

`rg "bg-teal-|bg-emerald-|text-teal-|text-emerald-|border-stone-|px-\[" src/app/admin` — **30개 파일 · 466건** (2026-04-21). 대표 현상:

| # | 파일:라인 | 현재 | 문제 |
|---|---|---|---|
| 1 | `src/app/admin/distribute/distribute-tabs.tsx:111-113` | `bg-amber-100 text-amber-700` · `bg-teal-100 text-teal-700` · `bg-emerald-100 text-emerald-700` | 상태 배지 3색이 raw palette. semantic 역할("주의/진행/성공") 부재 |
| 2 | `src/app/admin/distribute/distribute-tabs.tsx:707` | `bg-teal-600 hover:bg-teal-700 text-white` | 이미 `<Button>` primitive 가 있음에도 직접 `className` 으로 색 지정 |
| 3 | `src/app/admin/distribute/distribute-tabs.tsx:669, 683, 753` | `border-stone-200`, `bg-rose-50/50`, `border-stone-100` | 테이블 경계선·행 하이라이트가 raw palette |
| 4 | `src/app/s/[token]/page.tsx:44-53` | `bg-stone-50`, `text-stone-800`, `text-stone-500` | 응답자 비활성 화면이 `.expert-theme` 대신 raw palette |
| 5 | `src/app/d/[token]/page.tsx:65-70` | `bg-emerald-100`, `text-emerald-600` | 완료 아이콘 배경. 의미는 "성공 상태" 인데 raw 색 |
| 6 | `src/app/error.tsx:13-24` | `bg-rose-50`, `text-rose-500`, `bg-teal-600` | 루트 에러 화면 역시 raw palette, 버튼에 primitive 미사용 |
| 7 | `src/app/not-found.tsx:7, 14-16` | `text-stone-200`, `bg-teal-600` | 동일 |
| 8 | `src/app/s/[token]/survey-form.tsx:80-93` | `INTRO_STYLE_MAP` 에 `#fafaf9`, `#14b8a6` 등 hex 8세트 직접 정의 | 섹션 인트로 색이 토큰 밖에서 살아감 |

## 설계 원칙

### 계층 모델

```
primitive            →    semantic                     →    component
oklch 원시 값              의도 중심 역할                      컴포넌트 전용
──────────────────────────────────────────────────────────────────────
--primary                  --color-action-primary              --button-primary-bg
--destructive              --color-action-destructive          --button-destructive-bg
oklch(0.577 .245 27)       --color-surface-danger-subtle       --badge-danger-bg
oklch(0.97 0 0)            --color-surface-muted               --card-bg
```

- **primitive**: 이름에 색조가 드러나는 원시 값. 컴포넌트가 직접 쓰지 않는다.
- **semantic**: 의도(action / surface / text / border / status)만 드러낸다. 팀 내 "이 역할은 무엇" 합의가 이 층에서 이루어진다.
- **component**: 1개 컴포넌트에만 쓰이면 component 층으로 내려 가독성을 올린다. semantic 만으로 표현 가능하면 층을 나누지 않는다.

### 네이밍 컨벤션

`--<layer>-<intent>-<role>-<variant>-<state>`

- layer: `color` / `space` / `radius` / `shadow` / `motion`
- intent: `action` · `surface` · `text` · `border` · `status`
- role: `primary` · `secondary` · `success` · `warning` · `danger` · `info` · `neutral` · `muted`
- variant: `subtle` · `bold` · `on` (전경 대비용)
- state: `hover` · `active` · `disabled` · `focus`

예:
- `--color-action-primary`, `--color-action-primary-hover`, `--color-action-primary-on`
- `--color-surface-success-subtle`, `--color-text-success-on`
- `--color-border-muted`

### `.expert-theme` 의 미래

응답자 전용 스코프는 유지한다. 다만 이 스코프의 변수도 같은 3계층 규칙을 따르도록 **semantic 이름을 새로 붙여 별칭(alias)** 한다. 예: `--color-action-primary: var(--expert-primary-accent)` (`.expert-theme` 내).

관리자(`/admin/*`) 는 `.expert-theme` 바깥에서 같은 semantic 이름을 루트 토큰(`:root`)으로 받는다. 이렇게 하면 **컴포넌트는 어느 스코프에 있든 `bg-[--color-action-primary]` 한 줄로 동작**한다.

### Tailwind 연동

Tailwind v4 `@theme inline` 블록(`src/app/globals.css:7-49`)에 semantic/component 이름을 `--color-*` prefix 로 등록하면 `bg-primary` 같은 자동 utility 가 생긴다. semantic 층만 utility 화하고, component 층은 `bg-[--button-primary-bg]` 수동 참조로 남긴다 (과도한 utility 팽창 방지).

## Before / After

```tsx
// Before — src/app/admin/distribute/distribute-tabs.tsx:111-113
{ text: '열람', color: 'bg-amber-100 text-amber-700' }
{ text: '응답중', color: 'bg-teal-100 text-teal-700' }
{ text: '완료', color: 'bg-emerald-100 text-emerald-700' }

// After
{ text: '열람',   color: 'bg-[--color-surface-info-subtle]    text-[--color-text-info-on]' }
{ text: '응답중', color: 'bg-[--color-surface-progress-subtle] text-[--color-text-progress-on]' }
{ text: '완료',   color: 'bg-[--color-surface-success-subtle] text-[--color-text-success-on]' }
```

```tsx
// Before — src/app/error.tsx:22-27
<button className="px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">
  다시 시도
</button>

// After
<Button variant="default" size="lg" onClick={reset}>
  {t('error.retry')}
</Button>
```

```tsx
// Before — src/app/s/[token]/survey-form.tsx:80-93
const INTRO_STYLE_MAP: Record<string, { bg: string; borderLeft: string; color: string }> = {
  brand: { bg: '#f0fdfa', borderLeft: '#14b8a6', color: '#0d9488' },
  warm:  { bg: '#faf5f0', borderLeft: '#d97706', color: '#92400e' },
  // ...
}

// After  (값은 .expert-theme 스코프에서 alias 된 semantic 토큰 참조)
const INTRO_STYLE_MAP: Record<string, { className: string }> = {
  brand: { className: 'bg-[--color-intro-brand-surface]      border-l-[--color-intro-brand-accent]      text-[--color-intro-brand-on]' },
  warm:  { className: 'bg-[--color-intro-warm-surface]       border-l-[--color-intro-warm-accent]       text-[--color-intro-warm-on]' },
  // ...
}
```

## 로드맵

| 항목 | M/S/C/W | Phase | 비고 |
|---|---|---|---|
| semantic 토큰 이름·값 합의·도입 (최소 12개: action/surface/text/border × 3 role) | Must | P1 | `globals.css` |
| `.expert-theme` alias 브릿지 추가 | Must | P1 | 응답자 스코프 유지 |
| 상태 배지 3색(info/progress/success) 정의 및 `distribute-tabs.tsx` 적용 | Must | P1 | 대표 치환 |
| `error.tsx`, `not-found.tsx` → `Button` primitive + semantic 토큰 | Must | P1 | 루트 UX 정상화 |
| `INTRO_STYLE_MAP` 토큰화 (섹션 인트로 8색) | Should | P2 | 응답자 시각언어 |
| component token 층 도입 (`--button-*`, `--badge-*`) | Should | P2 | 필요 컴포넌트부터 |
| raw palette 검출 lint (ESLint + `eslint-plugin-tailwindcss` 또는 자체 규칙) | Should | P2 | CI gate |
| primitive 축소 (사용처 없는 `--chart-*` 정리) | Could | P3 | 현상 재조사 후 |
| 브랜드 리프레시 (oklch 값 재산정) | Won't | — | 별도 PRD |

## 수용지표

**정량**
- `rg "bg-teal-|bg-emerald-|bg-amber-|bg-rose-|bg-stone-|text-teal-|text-emerald-|text-stone-" src/app/admin src/app/s src/app/d src/app/hrd src/app/error.tsx src/app/not-found.tsx` 히트: **466 → Phase 2 말 < 50, Phase 3 말 < 10**.
- `rg "\[[0-9]+(px|rem|%)\]" src/app/admin src/app/s src/app/d src/app/hrd` (arbitrary spacing) 히트: 현재값 측정 후 Phase 3 말 -80%.
- semantic 토큰 신규 등록 ≥ 12개 (Phase 1).
- component 토큰 신규 등록 ≥ 8개 (Phase 2).
- CI 에 raw palette lint 가 실행되며 위반 시 빌드 실패.

**정성**
- 새 컴포넌트 PR 을 열 때, `className` 안에 raw palette 색이 리뷰어 코멘트 없이도 등장하지 않는다.
- "이 색은 무슨 의미?" 질문에 semantic 이름으로 답할 수 있다.

## 체크리스트

- [ ] 새 색을 추가하기 전에 기존 semantic 역할 중 맞는 게 없는지 확인했다.
- [ ] `.expert-theme` 스코프에서도 동일 semantic 이름이 동작하는지 테스트했다.
- [ ] primitive 값(oklch)을 직접 참조하지 않고 semantic 으로만 소비했다.
- [ ] RFC (`_templates/token-change.md`) 를 작성했다.
- [ ] `99-glossary.md` 에 새 이름을 등록했다.

## 관련 문서

- 상류: [01-principles.md](./01-principles.md)
- 하류: [03-components.md](./03-components.md), [05-admin-ux.md](./05-admin-ux.md), [08-accessibility.md](./08-accessibility.md)
- 템플릿: [`_templates/token-change.md`](./_templates/token-change.md)

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | 3계층·네이밍·Before/After 정의 |
