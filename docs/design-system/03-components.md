# 03. 컴포넌트 시스템 — primitive · composite · pattern

> **핵심 원칙.** 컴포넌트는 **primitive → composite → pattern** 3계층이다. 새 UI 를 만들기 전에 이 3층을 뒤진 뒤, **같은 의미의 반복이 2개 이상 발견되면 pattern 으로 승격**한다.

## 현상 진단

### 이미 잘 되어 있는 것

- `src/components/ui/button.tsx:8-43` — CVA 기반 `variant`(default/outline/secondary/ghost/destructive/link) × `size`(xs/sm/default/lg/icon…) 조합이 잘 정의됨. Base UI `ButtonPrimitive` 래핑.
- `src/components/ui/card.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `dialog.tsx`, `sheet.tsx`, `tabs.tsx`, `dropdown-menu.tsx`, `scroll-area.tsx`, `sonner.tsx` 등 primitive 구비.
- `src/components/survey/builder/*` — `BuilderShell` + Outline/Canvas/Inspector 3-컬럼 composite.
- `src/components/survey/LikertScale.tsx:78+` — stable composite, 5/6/7점 · disabled · 프리셋 라벨.

### 문제점

1. **composite 계층이 primitive 를 우회한다.**
   - `src/app/admin/distribute/distribute-tabs.tsx:707` — 이미 `<Button>` 을 쓰면서도 `className="bg-teal-600 hover:bg-teal-700 text-white"` 로 variant 를 덮어씀. `Button` 의 variant 시스템이 무력화됨.
   - `src/app/error.tsx:22-27`, `src/app/not-found.tsx:14-16` — `<button>` raw 태그로 작성. 루트 에러·404 가 primitive 를 안 쓰는 아이러니.

2. **pattern 중복.**
   - `src/app/s/[token]/page.tsx:43-55` (설문 비활성)
   - `src/app/d/[token]/page.tsx:62-98` (완료 / 비활성 / draft)
   - 거의 동일한 `min-h-screen bg-stone-50 flex items-center justify-center p-4` + `max-w-md w-full text-center bg-white rounded-xl shadow-sm border border-stone-200 p-8` + 아이콘 원 + 헤딩 + 서브텍스트 구조가 **3~4회 중복**.

3. **빈 상태·에러 경계·스켈레톤 패턴이 없다.**
   - 응답자 경로(`/s`, `/d`, `/hrd`) 에 `loading.tsx`·`error.tsx` 가 거의 없음. Suspense 도 미사용.

## 설계 원칙

### A. 계층 정의

| 계층 | 위치 | 예시 | 외부가 알아야 할 것 |
|---|---|---|---|
| primitive | `src/components/ui/*` | `Button`, `Card`, `Badge`, `Dialog`, `Sheet`, `Input`, `Tabs` | Props, variant, size, a11y 계약 |
| composite | `src/components/{survey,respond,charts,forms}/*` | `LikertScale`, `BuilderShell`, `SurveyBottomNav` | 어디서 쓰는지, 언제 깨지는지 |
| pattern | `src/components/patterns/*` (신규) | `CompletionScreen`, `EmptyState`, `ErrorBoundaryFallback`, `SkeletonSurvey`, `ProgressDots`, `AutoSaveIndicator` | 언제 교체되나, 테스트 covers 무엇 |

### B. CVA 규약

1. primitive 는 **CVA 기반 variant** 만 외부에 노출한다. 색·spacing·radius 는 안에서 토큰으로 잠근다.
2. 호출부는 `className` 으로 색을 덮어쓰지 않는다. 덮어써야 한다면 **새 variant** 가 필요하다는 신호 → RFC.
3. 모든 primitive 는 `data-slot="<name>"` 을 가진다 (현 `button.tsx:53` 패턴). QA/테스트/디자인 토큰 역추적에 사용.

### C. 컴포넌트 등급

| 등급 | 의미 | 예시 |
|---|---|---|
| `stable` | 토큰·a11y·스토리·사용처 ≥ 3 | `Button`, `Card`, `LikertScale` |
| `experimental` | 도입 직후, 변경 허용 | 신규 `CompletionScreen` 초안 |
| `deprecated` | 제거 예정 | `/app/admin/distribute/distribute-tabs.tsx:707` 에 박힌 커스텀 버튼 스타일 (이관 완료 시 제거) |

등급 변경은 해당 컴포넌트 파일 상단 JSDoc `@designStatus` 로 표시 + 이 문서 Pattern 목록에 반영.

### D. 신규 pattern 후보 (승격 대상)

1. **`CompletionScreen`** — `/s`, `/d` 중복 제거.
   - Props: `{ tone: 'neutral' | 'success' | 'warning' | 'danger', icon?, title, description, action? }`
   - `.expert-theme` 스코프 내에서만 사용 (응답자 전용).
2. **`EmptyState`** — 리포트·응답 테이블의 "데이터 없음" 통일.
3. **`ErrorBoundaryFallback`** — `error.tsx`·`not-found.tsx` 공통 골격. 3요소 카피(`06-ux-writing.md`) 강제.
4. **`SkeletonSurvey`** — 응답자 로딩용. 헤더 + 진행 바 + 3 문항 플레이스홀더.
5. **`SkeletonAdminTable`** — `/admin/responses`, `/admin/reports` 표용.
6. **`ProgressDots`** — 섹션 전환 인디케이터 (엄지영역 밖 상단).
7. **`AutoSaveIndicator`** — `/hrd` 의 "저장 중…/저장됨" 라벨을 `/s`, `/d` 로 이식할 때 공용.
8. **`ConfirmDialog`** — `Dialog` primitive 래핑, 파괴적 동작(삭제·발송 취소) 전용.

### E. 카탈로그 전략

Storybook 은 도입하지 않는다 (런타임 의존성·번들 증가·유지비).
대신 **내부 라우트 `/admin/_catalog`** 에 MDX 기반 페이지를 둔다 (인증 뒤, 프로덕션 빌드 제외). 각 primitive 의 variant × size 매트릭스, 관련 pattern 예시, 관련 토큰 링크를 한 페이지에서 본다.

## Before / After

```tsx
// Before — src/app/s/[token]/page.tsx:43-55  (중복 #1)
<div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
  <div className="max-w-md w-full text-center bg-white rounded-xl shadow-sm border border-stone-200 p-8">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
      <svg className="h-8 w-8 text-stone-400" …/>
    </div>
    <h2 className="text-xl font-bold text-stone-800 mb-2">설문이 종료되었습니다</h2>
    <p className="text-sm text-stone-500">이 설문은 현재 응답을 받지 않고 있습니다.</p>
  </div>
</div>

// After — 공용 pattern
<CompletionScreen
  tone="neutral"
  icon={<AlertCircle />}
  title={t('respondent.inactive.title')}
  description={t('respondent.inactive.description')}
/>
```

```tsx
// Before — src/app/error.tsx:22-27
<button
  onClick={reset}
  className="px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
>
  다시 시도
</button>

// After
<ErrorBoundaryFallback
  title={t('error.global.title')}
  description={t('error.global.description', { reason: error.message })}
  action={{ label: t('error.retry'), onClick: reset }}
/>
```

```tsx
// Before — src/app/admin/distribute/distribute-tabs.tsx:707
<Button onClick={handleGenerate} disabled={validRows.length === 0}
        className="bg-teal-600 hover:bg-teal-700 text-white">
  링크 생성
</Button>

// After — Button variant 를 그대로 신뢰
<Button variant="default" size="lg" onClick={handleGenerate} disabled={validRows.length === 0}>
  {t('distribute.generateLinks')}
</Button>
```

## 로드맵

| 항목 | M/S/C/W | Phase | 담당 문서 |
|---|---|---|---|
| `patterns/CompletionScreen.tsx` 신규 + `/s`·`/d` 이식 | Must | P1 | 03, 04, 06 |
| `patterns/ErrorBoundaryFallback.tsx` + `error.tsx`·`not-found.tsx` 이식 | Must | P1 | 03, 06 |
| `patterns/EmptyState.tsx` + `/admin/responses`·`/admin/reports` 이식 | Should | P2 | 03, 05 |
| `SkeletonSurvey`, `SkeletonAdminTable` | Should | P2 | 03, 04, 05 |
| `ProgressDots`, `AutoSaveIndicator` | Should | P2 | 04 |
| `ConfirmDialog` wrapper | Should | P2 | 03, 05 |
| `/admin/_catalog` MDX 페이지 | Could | P3 | 03 |
| 각 primitive 에 `@designStatus` JSDoc | Could | P3 | 03 |
| Storybook 도입 | Won't | — | 번들·유지비 사유 |

## 수용지표

**정량**
- 중복된 완료/에러 박스 구현 수 (`min-h-screen …center` + 원형 아이콘 패턴 grep): 현재 3~4곳 → 1 (`CompletionScreen`).
- `<Button>` 에 `className` 으로 색 override 하는 케이스: 현재 측정 후 Phase 2 말 0건.
- Primitive 미사용 raw `<button>` 태그: 현재 측정 → Phase 2 말 응답자·admin 0건.
- 신규 pattern 8개 중 Phase 2 완료 ≥ 5개.

**정성**
- PR 리뷰어가 "같은 게 어디 있지?" 라고 묻지 않는다 (pattern 목록만 보면 된다).
- 새 기능 개발 시 composite 를 먼저 조립하고, primitive 수정이 필요하면 멈추고 RFC 를 연다.

## 체크리스트

- [ ] 만들려는 것이 기존 pattern 으로 커버되는지 확인했다.
- [ ] primitive 의 `className` 으로 색/spacing 을 덮어쓰지 않았다.
- [ ] 새 pattern 이면 RFC (`_templates/component-spec.md`) 를 작성했다.
- [ ] `data-slot` 과 a11y 속성을 넣었다.
- [ ] `@designStatus` JSDoc 을 적었다.
- [ ] `99-glossary.md` 에 새 pattern 이름을 등록했다.

## 관련 문서

- 상류: [01-principles.md](./01-principles.md), [02-tokens.md](./02-tokens.md)
- 하류: [04-respondent-ux.md](./04-respondent-ux.md), [05-admin-ux.md](./05-admin-ux.md), [08-accessibility.md](./08-accessibility.md)
- 템플릿: [`_templates/component-spec.md`](./_templates/component-spec.md)

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | 3계층·pattern 후보 8개·등급 정의 |
