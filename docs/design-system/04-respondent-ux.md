# 04. 응답자 UX — `/s`, `/d`, `/hrd`

> **핵심 원칙.** 응답자는 3~5분 안에, 모바일에서, 한 손으로 설문을 끝낼 수 있어야 한다. 모든 설계는 **마이크로태스크 분할 · 엄지영역 CTA · 인지 부하 최소화**를 기준으로 재단한다 (원티드 UX 철학).

## 현상 진단

### 라우트 비교

| 항목 | `/s/[token]` (공개) | `/d/[token]` (개인 링크) | `/hrd/[token]` (HRD 실태조사) |
|---|---|---|---|
| 진입 파일 | `src/app/s/[token]/page.tsx` | `src/app/d/[token]/page.tsx` | `src/app/hrd/[token]/page.tsx` |
| 폼 파일 | `src/app/s/[token]/survey-form.tsx` | (동일 `s/.../survey-form.tsx` 재사용) | `src/app/hrd/[token]/survey-form.tsx` |
| 비활성 화면 | `page.tsx:43-55` | `page.tsx:62-98` (3종: 완료/draft/종료) | 별도 |
| 진행률 | `settings.show_progress` 조건부 | 동일 | `progress = ((currentPartIndex+1)/totalParts)*100` |
| 자동저장 / 임시저장 | 없음 | 없음 | **있음** (`survey-form.tsx` 의 `saving` state, "임시 저장" 버튼) |
| 페이지 전환 애니메이션 | 없음 (즉시) | 없음 | 없음 |
| safe-area-inset 처리 | 없음 | 없음 | 없음 |
| Suspense/`loading.tsx`/`error.tsx` | 없음 | 없음 | 없음 |
| `.expert-theme` 스코프 사용 | 부분 (SurveyForm 내부) | 부분 | 부분 |
| 엄지영역 CTA | `SurveyBottomNav` 로 일부 구현 | 동일 | 상단·하단 혼재 |
| `useOptimistic` 사용 | 없음 | 없음 | 없음 |

### 대표 문제

1. **CompletionScreen 중복** — [`03-components.md`](./03-components.md) §B. 3~4회 반복되는 박스.
2. **모바일 safe-area 공백** — iPhone 홈 인디케이터에 하단 CTA 가 겹쳐 터치가 실패함 (`SurveyBottomNav` 가 `env(safe-area-inset-bottom)` 를 쓰지 않음).
3. **자동저장 격차** — `/hrd` 에만 있고, `/s`, `/d` 는 새로고침 시 응답 전량 유실.
4. **로딩 구멍** — 토큰 조회·설문 로드 중 빈 화면. 스켈레톤 없음.
5. **AI 오류 불투명** — AI 로 생성된 설문의 에러 복구 경로가 응답자에게 안 보임 (서버 로그로만 간다).

## 설계 원칙

### A. 마이크로태스크 분할

- 섹션 1개 = 화면 1개. 섹션당 문항 3~7개 권장.
- 섹션 간 전환 시 스크롤을 0,0 으로 리셋하고 다음 섹션의 첫 문항에 포커스.
- 섹션 전환 애니메이션: `translateX(16px)` + opacity 120ms `ease-out`. `prefers-reduced-motion: reduce` 시 비활성.

### B. 엄지영역 CTA

- "다음 / 이전 / 제출" 버튼은 하단 고정 바(`SurveyBottomNav`)에 둔다.
- 버튼 최소 크기 44×44pt, 버튼 간 간격 ≥ 8px.
- 하단 고정 바는 `padding-bottom: calc(16px + env(safe-area-inset-bottom))` 적용.
- 키보드가 올라올 때는 `visualViewport` API 로 하단 바를 viewport 위로 재배치.

### C. 진행률·자동저장

- 헤더에 `ProgressDots` (섹션 단위) 또는 `ProgressBar` (문항 단위). 둘 중 하나만.
- 입력 변경 시 디바운스 800ms 후 자동 저장 (`/hrd` 로직을 공용 `useAutoSave(surveyId, answers)` 훅으로 추출).
- `AutoSaveIndicator` 컴포넌트로 "저장 중…/방금 저장됨" 라벨을 하단 좌측에 표시.

### D. 로딩·에러·빈 상태

- 각 라우트에 `loading.tsx` + `error.tsx` 를 둔다.
- `loading.tsx` 는 `SkeletonSurvey` 사용.
- `error.tsx` 는 `ErrorBoundaryFallback` (tone=danger) 사용. 카피 3요소: 무슨 일·왜·다음 행동.
- 완료/비활성/draft/종료 4상태는 `CompletionScreen` 의 `tone` prop 으로만 분기.

### E. 낙관 UI

- 답변 저장·섹션 이동·"좋아요/별점" 같은 가벼운 상호작용에 `useOptimistic` 적용.
- 실패 시 toast(`sonner`)로 롤백 알림: 메시지 3요소 준수.
- 제출(`submit`) 같은 파괴·일회성 동작은 낙관 UI 에서 **제외** (결제 규칙과 동일).

### F. 모션 예산

- 총 모션 길이 ≤ 250ms.
- `prefers-reduced-motion` 에서 전역 비활성.
- 섹션 전환, `AutoSaveIndicator` fade, CTA pressed 피드백 3종 외에는 추가 금지.

## Before / After

```tsx
// Before — /s, /d 비활성 중복 (src/app/s/[token]/page.tsx:43-55 · src/app/d/[token]/page.tsx:62-98)
{/* 세 번 비슷한 박스 */}

// After — CompletionScreen + tone
<CompletionScreen
  tone={survey.status === 'draft' ? 'warning' : 'neutral'}
  icon={<AlertCircle />}
  title={t(survey.status === 'draft' ? 'respondent.draft.title' : 'respondent.inactive.title')}
  description={t(survey.status === 'draft' ? 'respondent.draft.description' : 'respondent.inactive.description')}
/>
```

```tsx
// Before — 자동저장 없음 (src/app/s/[token]/survey-form.tsx)
const [answers, setAnswers] = useState({})
// 새로고침 시 전량 유실

// After — 공용 훅
const { answers, setAnswers, savedAt, saving } = useAutoSave(surveyId, initialAnswers, {
  debounceMs: 800,
  scope: distributionToken ? `d:${distributionToken}` : `s:${token}`,
})
<AutoSaveIndicator saving={saving} savedAt={savedAt} />
```

```tsx
// Before — 하단 CTA 가 홈 인디케이터에 겹침
<div className="fixed bottom-0 left-0 right-0 bg-white px-8 py-4">…</div>

// After — safe-area + 키보드 대응
<div
  className="fixed inset-x-0 bottom-0 bg-[--color-surface-lowest] px-6"
  style={{ paddingBottom: `calc(16px + env(safe-area-inset-bottom))` }}
>…</div>
```

## 로드맵

| 항목 | M/S/C/W | Phase | 비고 |
|---|---|---|---|
| `CompletionScreen` 이식 (`/s`, `/d`) | Must | P1 | `03` pattern |
| `loading.tsx` · `error.tsx` 추가 (`/s`, `/d`, `/hrd`) | Must | P1 | 총 6 파일 |
| `SurveyBottomNav` 의 safe-area + 키보드 대응 | Must | P1 | `src/components/respond/survey-bottom-nav.tsx` |
| `useAutoSave` 훅으로 `/hrd` 로직 공용화 → `/s`, `/d` 이식 | Must | P2 | 서버 액션·로컬스토리지 하이브리드 |
| `SkeletonSurvey` 적용 | Should | P2 | 03 pattern |
| `useOptimistic` — 답변 저장·섹션 이동 | Should | P2 | React 19 |
| 섹션 전환 애니메이션 | Should | P2 | reduced-motion 분기 |
| 키보드 `visualViewport` 재배치 | Could | P3 | iOS Safari 검증 |
| `ProgressDots` vs `ProgressBar` A/B | Could | P3 | 설문 길이별 |
| PWA 오프라인 응답 임시보존 | Won't | — | 별도 PRD |

## 수용지표

**정량**
- `/s`, `/d`, `/hrd` 각 경로에 `loading.tsx`, `error.tsx` 보유 (6/6).
- 하단 CTA 가 safe-area 를 반영하는 경로 3/3.
- 자동저장 보유 경로 현재 1 → Phase 2 말 3.
- Lighthouse Mobile Performance p75 ≥ 90 (`/s`, `/d`, `/hrd` 모두).
- Lighthouse A11y p75 ≥ 95.
- INP p75 < 200ms (응답자 경로, RUM 기준).
- 제출 실패율 (`/api/surveys/[token]/submit` 5xx) < 0.5%.

**정성**
- 사용자가 섹션을 옮길 때 "스크롤이 어디 있지" 라고 묻지 않는다 (포커스·스크롤 관리 적절).
- 새로고침 후에도 작성 중이던 답이 남아 있다 (`/s`, `/d` 포함).

## 체크리스트

- [ ] 섹션이 3~7 문항 범위다.
- [ ] 하단 CTA 가 safe-area 를 반영한다.
- [ ] 키보드가 올라와도 CTA 가 가려지지 않는다.
- [ ] `loading.tsx` / `error.tsx` 가 있다.
- [ ] 자동저장이 있고 `AutoSaveIndicator` 를 노출한다.
- [ ] `prefers-reduced-motion` 에서 모션이 꺼진다.
- [ ] `CompletionScreen` / `ErrorBoundaryFallback` 로 상태 박스를 통합했다.
- [ ] 접근성: 포커스 순서·aria-live(자동저장 알림)·버튼 라벨 점검.

## 관련 문서

- 상류: [01-principles.md](./01-principles.md) §B, [03-components.md](./03-components.md)
- 하류: [06-ux-writing.md](./06-ux-writing.md), [07-ai-patterns.md](./07-ai-patterns.md), [08-accessibility.md](./08-accessibility.md)

_라우팅 스코프: 실사용만 (`/s`, `/d`, `/hrd`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | 라우트 비교·마이크로태스크·엄지영역·자동저장 정의 |
