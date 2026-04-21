# 08. 접근성 — Accessibility First

> **핵심 원칙.** 접근성은 나중에 "추가" 하는 기능이 아니라 *컴포넌트의 완료 정의* 다. 새로 만드는 모든 것이 WCAG 2.1 AA 를 기본선으로 한다 (토스 TDS Accessibility First).

## 현상 진단

### 이미 있는 것

- `src/components/ui/button.tsx:9` — `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`, `aria-invalid:border-destructive ring-destructive/20`, `disabled:pointer-events-none disabled:opacity-50`.
- 빌더 구성요소에 `aria-label` 산재 (예: `aria-label="드래그로 순서 변경"`, `"필수"`, `"선택지 삭제"`).
- Input/Textarea/Switch 가 `focus-visible:ring-3` + `aria-invalid` 지원.

### 부재

- 색 대비 자동 검증 없음.
- 포커스 트랩(다이얼로그, Sheet) 규약 문서화 없음.
- `prefers-reduced-motion`, `prefers-contrast` 분기 없음.
- 자동저장 알림 (`aria-live`) 없음.
- 스크린리더용 스킵 링크 없음.
- 키보드 탭 순서 문서 없음.

## 설계 원칙

### A. 기본선

- **대비비** 본문 ≥ 4.5:1, 대형 텍스트 ≥ 3:1, UI 구성요소/경계 ≥ 3:1 (WCAG 2.1 AA).
- oklch 토큰은 L(명도) 값 기준 대비 계산을 문서 `02-tokens.md` RFC 에 필수 포함.
- 포커스 표시는 항상 보이며 토큰 `--color-focus-ring` 으로 통일.

### B. 키보드

- 모든 상호작용 요소는 키보드로 접근 가능 (탭/엔터/스페이스).
- 다이얼로그·Sheet 열릴 때 포커스를 첫 상호작용 요소로 이동, 닫힐 때 원래 트리거로 복귀.
- 다이얼로그·Sheet 내부 탭은 트랩되고 `Esc` 로 닫힌다.
- 빌더처럼 커스텀 키 기반 UI 는 `role="application"` 안에서만 활성화하고, 외부 탐색은 표준 탭 유지.

### C. ARIA 패턴

- 아이콘-only 버튼은 `aria-label`.
- 상태 배지(`Badge tone=success` 등)는 `role="status"` 가 아니라 시각 요소로 취급하되, **상태 변화 실시간 알림**만 `aria-live="polite"` 영역 사용.
- 테이블: `<th scope="col">`, 정렬 가능 열 `aria-sort`.
- Likert: `role="radiogroup"` + 각 옵션 `role="radio"` + 문항 제목을 `aria-labelledby`.
- 진행률: `ProgressBar` 는 `role="progressbar"` + `aria-valuemin/max/now/text`.

### D. 모션

- 전역 `@media (prefers-reduced-motion: reduce)` 에서 모든 `transition`·`animation` 을 `0.01ms` 로 축소.
- 자동 재생 애니메이션(로띠) 사용 금지.

### E. 스크린리더

- 자동저장 상태는 `aria-live="polite"` + `aria-atomic="true"` 영역에 "방금 저장됐어요" 텍스트.
- 에러 요약: 폼 상단에 `role="alert"` + 각 에러로 이동하는 `aria-describedby`.
- 섹션 전환 후 포커스는 다음 섹션의 heading(`<h2>`)으로.

### F. 자동 검증

- Playwright `@axe-core/playwright` 로 `/s`, `/d`, `/hrd`, `/admin/surveys`, `/admin/distribute`, `/admin/reports` 각 1회씩 스냅샷 검증.
- CI 에서 `serious`/`critical` 위반 발생 시 빌드 실패.
- `playwright.config.ts` 에 a11y 프로젝트 추가.

### G. 수동 QA

- 릴리즈 전 주요 경로 3종을 **VoiceOver(iOS)**, **TalkBack(Android)**, **NVDA(Windows)** 중 최소 2종으로 탭-only 순회.
- 색약 시뮬레이션 (Protanopia / Deuteranopia) 으로 상태 배지 구분 가능성 확인.

## Before / After

```tsx
// Before — 아이콘-only 버튼 라벨 누락 (가상의 흔한 예)
<button onClick={onDelete}><Trash2 /></button>

// After
<Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={t('distribute.deleteRespondent')}>
  <Trash2 aria-hidden="true" />
</Button>
```

```tsx
// Before — 자동저장 토스트만
toast('저장되었습니다')

// After — aria-live 영역
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {saving ? t('autosave.saving') : savedAt ? t('autosave.savedAt', { time: fmt(savedAt) }) : ''}
</div>
```

```tsx
// Before — Likert markup 이 단순 <input type="radio">
<input type="radio" name={q.id} value={5} />

// After — role + aria-labelledby
<fieldset role="radiogroup" aria-labelledby={`q-${q.id}-title`}>
  <legend id={`q-${q.id}-title`} className="sr-only">{q.title}</legend>
  {[1,2,3,4,5].map(n => (
    <label key={n}><input type="radio" name={q.id} value={n} /> {likertLabels[n]}</label>
  ))}
</fieldset>
```

## 로드맵

| 항목 | M/S/C/W | Phase | 대상 |
|---|---|---|---|
| `--color-focus-ring` semantic 토큰 정의 | Must | P1 | `02-tokens.md` 연동 |
| 다이얼로그·Sheet 포커스 트랩 공통 훅 | Must | P1 | `src/components/ui/dialog.tsx`, `sheet.tsx` |
| `prefers-reduced-motion` 전역 분기 | Must | P1 | `globals.css` |
| 자동저장 `aria-live` 영역 (`AutoSaveIndicator` 내) | Must | P1 | `04-respondent-ux.md` 연동 |
| 아이콘-only 버튼 `aria-label` 감사 | Should | P2 | admin 전역 |
| 상태 배지 색약 대비 검증·조정 (`--chart-*` 포함) | Should | P2 | `02-tokens.md` |
| Playwright axe 프로젝트 + CI 게이트 | Should | P2 | `playwright.config.ts` |
| 스킵 링크 `<a href="#main">` | Should | P2 | admin layout, respondent layout |
| 수동 QA 체크리스트 릴리즈 템플릿 | Could | P3 | 릴리즈 문서 |
| `prefers-contrast: more` 전용 팔레트 | Won't | — | 별도 RFC |

## 수용지표

**정량**
- Lighthouse A11y p75 ≥ 95 (`/s`, `/d`, `/hrd`, `/admin/*` 주요 5 페이지).
- Playwright axe: `serious`+`critical` 위반 0건 (CI 게이트).
- 대비비 위반: 0건 (semantic 토큰 추가 RFC 검증 단계에서 걸러짐).
- `aria-label` 누락 아이콘 버튼: 0건 (Phase 2 말 admin 기준).

**정성**
- VoiceOver 로 `/s` 를 처음부터 끝까지 탭-only 완주 가능.
- `prefers-reduced-motion` 사용자가 시각적 불편 없이 사용 가능.

## 체크리스트

- [ ] 대비비가 AA 를 통과한다 (토큰 정의 단계에서 확인).
- [ ] 포커스 링이 보이고 `--color-focus-ring` 토큰을 쓴다.
- [ ] 키보드만으로 전 인터랙션 가능.
- [ ] 다이얼로그·Sheet 에 포커스 트랩이 있다.
- [ ] `prefers-reduced-motion` 분기가 있다.
- [ ] 아이콘-only 버튼에 `aria-label` 이 있다.
- [ ] 동적 상태 변화에 `aria-live` 가 있다.
- [ ] Playwright axe 가 통과한다.

## 관련 문서

- 상류: [01-principles.md](./01-principles.md) §A3, [02-tokens.md](./02-tokens.md), [03-components.md](./03-components.md)
- 하류: [04-respondent-ux.md](./04-respondent-ux.md), [05-admin-ux.md](./05-admin-ux.md), [07-ai-patterns.md](./07-ai-patterns.md)

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | WCAG AA 기본선·ARIA 패턴·axe CI 게이트 정의 |
