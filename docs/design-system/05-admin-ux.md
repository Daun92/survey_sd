# 05. 관리자 UX — `/admin/*`

> **핵심 원칙.** 관리자는 빌더 → 배포 → 리포트 → 응답을 매일 반복한다. 각 페이지가 *같은 의미의 같은 위젯* 을 제공해야 인지 부하가 누적되지 않는다 (TDS 일관성 · 원티드 인지 부하 최소화).

## 현상 진단

### 공통 레이아웃

- `src/app/admin/layout.tsx:47-52` — `Sidebar` 고정(`ml-60`) + `main p-8`. 1차 구조는 통일됨.
- Sidebar 뱃지 데이터는 layout 에서 Supabase 3 쿼리 병렬 수집 (`layout.tsx:10-28`).

### 라우트 (실사용 Supabase edu_\*)

| 라우트 | 역할 | 주요 파일 |
|---|---|---|
| `/admin/surveys` · `/admin/surveys/[id]` | 빌더 3-컬럼 | `components/survey/builder/BuilderShell.tsx` |
| `/admin/distribute` | 배포·발송 | `src/app/admin/distribute/distribute-tabs.tsx` |
| `/admin/reports` | 교육 리포트 5탭 | `src/app/admin/reports/ReportTabs.tsx` |
| `/admin/responses/[surveyId]` | 응답 테이블 | `src/app/admin/responses/responses-view.tsx` |
| `/admin/hrd/*` | HRD 실태조사 | 별도 도메인 |
| `/admin/settings`, `/admin/account`, `/admin/email-templates`, `/admin/sms-templates`, `/admin/cs-templates`, `/admin/projects`, `/admin/respondents`, `/admin/quick-create` | 부속 도구 | — |

### 문제점 (grep 근거 · `/src/app/admin` 범위)

- `rg "bg-teal-|bg-emerald-|text-teal-|text-emerald-|border-stone-|px-\[" src/app/admin` → **30 파일 · 466건**. 대표:
  - `src/app/admin/distribute/distribute-tabs.tsx:111-113` — 상태 배지 색 직접 하드코딩.
  - `src/app/admin/distribute/distribute-tabs.tsx:707` — `<Button>` + `className` 색 override.
  - `src/app/admin/distribute/distribute-tabs.tsx:669, 683, 753` — 테이블 경계선/행 하이라이트 raw palette.
  - `src/app/admin/surveys/[id]/components/SurveyInfoEditor.tsx` — `bg-teal-600`, `border-stone-300`.
  - `src/app/admin/hrd/design/design-actions.tsx:70-76` — 추가 버튼 `rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white`.
- 빈 상태(데이터 없음) UI 가 페이지마다 다른 언어·스타일.
- 파괴적 동작(설문 삭제, 차수 삭제) 확인 다이얼로그 스타일이 page 마다 다름.
- `/admin/reports` 차트 팔레트(`--chart-1 ~ --chart-5`)가 흑백 grayscale 만이라 그룹 구분 약함 (`globals.css:70-74`).

## 설계 원칙

### A. 상태·액션 배지 통일

상태의 **의미** 가 같으면 색도 같다. 전 admin 에서 다음 5 셋트만 허용:

| 의미 | semantic | 예시 상태값 |
|---|---|---|
| 중립 / 대기 | `--color-surface-muted` + `--color-text-muted` | `pending`, `draft`, `unknown` |
| 진행 중 | `--color-surface-progress-subtle` + `--color-text-progress-on` | `opened`, `started`, `sending` |
| 성공 / 완료 | `--color-surface-success-subtle` + `--color-text-success-on` | `completed`, `active`, `sent` |
| 경고 | `--color-surface-warning-subtle` + `--color-text-warning-on` | `expiring`, `retrying` |
| 위험 / 실패 | `--color-surface-danger-subtle` + `--color-text-danger-on` | `failed`, `blocked`, `deleted` |

→ `distribute-tabs.tsx:111-113` 을 [`02-tokens.md`](./02-tokens.md) §Before/After 대로 치환.

### B. 버튼 사용 규칙

- `variant="default"` = 페이지의 **가장 중요한 1개 액션** (제출/저장/발송).
- `variant="secondary"` = 보조 액션 (초안 저장, 미리보기).
- `variant="outline"` = 비파괴 대안 (취소, 닫기).
- `variant="destructive"` = 삭제·되돌릴 수 없는 동작.
- `variant="ghost"` = 행간 아이콘 버튼.
- **`className` 으로 색 override 금지** ([03-components.md](./03-components.md) §B).

### C. 확인 다이얼로그 (파괴적 동작)

- `ConfirmDialog` 패턴 사용 ([03-components.md](./03-components.md) §D).
- 타이틀: "무엇을 한다" (명령형). 본문: "결과가 무엇" + "복구 가능 여부". 버튼: `취소` (ghost) / `삭제` (destructive, label 은 동작 동사 그대로).
- 파괴적 동작은 확인 입력(타이핑) 옵션을 제공 (예: 프로젝트 삭제 시 "삭제" 입력).

### D. 빈 상태 & 로딩

- 데이터 없음: `EmptyState` 패턴 (아이콘 + 1줄 설명 + 선택적 primary CTA).
- 초기 로딩: `SkeletonAdminTable` / `SkeletonCard` (라우트 단위 `loading.tsx`).
- 에러: `ErrorBoundaryFallback` (admin 전용 섹션 단위로도 사용).

### E. 리포트 차트 팔레트

- `--chart-1 ~ --chart-5` 를 grayscale 에서 **semantic 구분 가능한 색 5종**으로 재정의한다. oklch C(채도) 값을 일정하게 유지해 접근성 통과.
- Likert 분포(`likert-distribution`), 점수 막대(`score-bar`), 섹션 점수(`section-score-table`), 히트맵(`respondent-matrix`) 4종이 공유.

### F. 키보드 단축키 (빌더 한정)

- `J/K` 문항 이동, `⌘/Ctrl+S` 저장, `?` 도움말 모달. 기존 관행 확인 후 확정.
- 단축키는 설문 전체 접근성 컨텍스트(`role="application"`) 안에서만 활성.

## Before / After

```tsx
// Before — src/app/admin/distribute/distribute-tabs.tsx:111-113
const STATUS: Record<string, { text: string; color: string }> = {
  opened:    { text: '열람',   color: 'bg-amber-100 text-amber-700' },
  started:   { text: '응답중', color: 'bg-teal-100 text-teal-700' },
  completed: { text: '완료',   color: 'bg-emerald-100 text-emerald-700' },
}

// After — semantic 역할 + 공용 Badge
const STATUS = {
  opened:    { text: t('distribute.status.opened'),    tone: 'warning'  },
  started:   { text: t('distribute.status.started'),   tone: 'progress' },
  completed: { text: t('distribute.status.completed'), tone: 'success'  },
} as const

<Badge tone={STATUS[status].tone}>{STATUS[status].text}</Badge>
```

```tsx
// Before — src/app/admin/hrd/design/design-actions.tsx:70-76
<button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">
  파트 추가
</button>

// After
<Button variant="default" size="default">
  {t('hrd.design.addPart')}
</Button>
```

```tsx
// Before — 빈 상태 제각각
<div className="text-stone-400 text-sm p-8 text-center">아직 응답이 없습니다.</div>

// After
<EmptyState
  icon={<Inbox />}
  title={t('admin.responses.empty.title')}
  description={t('admin.responses.empty.description')}
/>
```

## 로드맵

| 항목 | M/S/C/W | Phase | 대상 파일 |
|---|---|---|---|
| 상태 배지 semantic 치환 (`distribute-tabs.tsx:111-113`) | Must | P1 | `distribute-tabs.tsx` |
| `<Button>` override 제거 (`distribute-tabs.tsx:707`, `SurveyInfoEditor.tsx`, `hrd/design/design-actions.tsx`) | Must | P1 | 3 파일 |
| 테이블 경계/하이라이트 토큰 치환 | Must | P2 | `distribute-tabs.tsx`, `responses-view.tsx`, `ReportTabs.tsx` |
| `EmptyState`, `ConfirmDialog` 이식 | Must | P2 | admin 전역 |
| `loading.tsx` / `error.tsx` 라우트별 추가 | Should | P2 | `/admin/surveys`, `/admin/distribute`, `/admin/reports`, `/admin/responses/[surveyId]` |
| 차트 팔레트 재정의 (`--chart-*`) + 차트 컴포넌트 소비처 확인 | Should | P2 | `globals.css`, `src/components/charts/*` |
| 빌더 단축키 공식화 (`?` 모달) | Could | P3 | `BuilderShell.tsx` |
| 사이드바 뱃지 데이터 캐싱 | Could | P3 | `layout.tsx` |

## 수용지표

**정량**
- `/admin` 범위 raw palette grep 히트: 466 → Phase 2 말 < 80, Phase 3 말 < 15.
- `<Button>` 에 `className="bg-..."` 패턴 검출: 0 (Phase 2 말).
- 상태 배지 색 셋트 수: ≥ 5 파일에서 동일 semantic 소비.
- 빈 상태·에러·확인 다이얼로그의 UI 일관성 (리뷰 샘플링) ≥ 90%.

**정성**
- 신규 관리자 기능 추가 시, 기존 페이지를 복사하지 않고 primitive + pattern 을 조립해 시작한다.
- "이 상태 뱃지가 뭐였지?" 라는 질문이 리포트-배포 간에서 사라진다.

## 체크리스트

- [ ] `<Button>` primitive 에 `className` 으로 색을 덮지 않았다.
- [ ] 상태 배지는 5 semantic 셋트 중 하나를 사용한다.
- [ ] 빈 상태는 `EmptyState`, 파괴적 동작은 `ConfirmDialog` 이다.
- [ ] 파괴적 동작 다이얼로그 카피가 "결과 + 복구 가능 여부"를 포함한다.
- [ ] 차트 색은 `--chart-*` 토큰만 사용한다.
- [ ] 라우트에 `loading.tsx` / `error.tsx` 가 있다.
- [ ] a11y: 다이얼로그 포커스 트랩, 테이블 `scope`, 정렬 `aria-sort`.

## 관련 문서

- 상류: [01-principles.md](./01-principles.md), [02-tokens.md](./02-tokens.md), [03-components.md](./03-components.md)
- 하류: [06-ux-writing.md](./06-ux-writing.md), [08-accessibility.md](./08-accessibility.md)

_라우팅 스코프: 실사용만 (`/admin/*`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | 상태 배지 5셋·확인 다이얼로그·차트 팔레트 정의 |
