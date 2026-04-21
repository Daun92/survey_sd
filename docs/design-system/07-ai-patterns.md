# 07. AI 상호작용 패턴 — `/api/ai/*` & Invisible Design

> **핵심 원칙.** AI 는 "기다림" 이 아니라 "대화" 여야 한다. 토큰 단위 스트리밍, 취소 가능, 실패 복구 가능, 결과물에 책임 표식. 사용자가 AI 임을 의식하지 않아도 되는 지점에서는 *보이지 않게* 작동한다 (원티드 Invisible Design).

## 현상 진단

### 기존 자산

- `src/app/api/ai/generate-questions/route.ts` — Gemini API + 파일 업로드 → 설문 문항 생성. 현재 일괄 JSON 응답.
- `src/app/api/ai/analyze-responses/route.ts` — 서술형 응답 분석. Gemini 호출.
- `src/app/api/ai/report-comment/route.ts` — 리포트 코멘트 생성 (존재 가정, CLAUDE.md 문서).
- `src/components/survey/wizard-panel.tsx` — 빌더에서 AI 마법사 Sheet 로 호출.
- `src/app/admin/reports/ai-comment.tsx`, `src/app/admin/reports/ai-open-analysis.tsx` — 리포트 내 AI 결과 표시.

### 문제

1. **스트리밍 없음.** 모든 AI 호출이 `fetch` 일괄. 10~30초 기다리는 동안 사용자에게 진행감이 없다.
2. **취소·재시도 UX 부재.** 잘못 탭한 경우 취소할 수단이 없음.
3. **실패 폴백 약함.** `GEMINI_API_KEY` 미설정·rate limit·네트워크 오류의 사용자용 카피가 없다.
4. **AI 생성 표식 없음.** 사용자가 "이 문구가 AI 가 만든 것" 인지 알 수 없다 (리포트 코멘트 등).
5. **Invisible 경계 불명확.** 자동 분류·요약처럼 *굳이* UI 로 드러낼 필요 없는 것과, 반드시 *표식이 필요한* 것이 섞여 있다.

## 설계 원칙

### A. 스트리밍 UX 규약

- 모든 AI 엔드포인트는 **SSE 또는 ReadableStream** 으로 토큰 단위 응답한다.
- 클라이언트는 첫 토큰 도착 전까지 `SkeletonAI` (shimmer 3줄), 이후 실시간 렌더링.
- p95 첫 토큰 시간 ≤ 1.5s.

### B. 취소·재시도

- 요청 시작 시 `AbortController` 생성, 사용자 취소 가능한 "중단" 버튼을 우측 상단에 노출.
- 실패 시 `ErrorBoundaryFallback` 과 동일한 3요소 카피 + "다시 시도" CTA.
- 사용자가 Sheet/Modal 을 닫으면 자동 abort.

### C. Invisible Design 경계

**표식 필요 (사용자에게 드러나야 함):**
- 리포트 코멘트, 빌더 AI 제안 문항, 열린 응답 요약.
- 마크업: 결과 블록 좌측에 `Sparkles` 아이콘 + "AI 가 작성한 초안이에요" 마이크로카피.

**Invisible (드러내지 않음):**
- 응답 자동 분류 (감정·주제 태깅).
- 리포트의 섹션 정렬·추천 차트 종류 선택.
- 빌더 유효성 경고 ("이 문항은 응답자가 혼동할 수 있어요").

### D. 책임 표식 카피

```
Sparkles + "AI 가 작성한 초안이에요. 확인 후 수정하거나 삭제할 수 있어요."
```

- 색: `--color-text-info-on` (semantic).
- 결과 블록은 편집 가능하며, 편집 시 "초안" 태그가 사라지도록 한다.

### E. 설정·권한 폴백

- `GEMINI_API_KEY` 미설정 또는 rate limit:
  - `/admin/*` 은 `EmptyState` (tone=info) + 설정 이동 CTA.
  - 응답자 경로는 AI 결과를 **절대 응답자에게 노출하지 않는다** (내부 분류용으로만).
- 타임아웃: 30s 초과 시 "응답이 늦어져요" 알림 + 취소 우선 권장.

### F. 관측·지표

- 엔드포인트별 로그: 입력 토큰 수, 출력 토큰 수, 지연, 취소 여부.
- 사용자별 한도 (일 N회) 도입 가능성 대비 훅 마련.

## Before / After

```ts
// Before — /api/ai/generate-questions (개념)
const body = await req.json()
const result = await gemini.generate(body.prompt)  // 20~30s 차단
return NextResponse.json({ questions: result.questions })

// After — Streaming
export async function POST(req: Request) {
  const { prompt, signal } = await req.json()
  const stream = await gemini.generateStream(prompt, { signal })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}
```

```tsx
// Before — wizard-panel.tsx (개념)
const [loading, setLoading] = useState(false)
const run = async () => {
  setLoading(true)
  const res = await fetch('/api/ai/generate-questions', { method: 'POST', body })
  const json = await res.json()
  setQuestions(json.questions)
  setLoading(false)
}

// After — 스트리밍 + 취소 + 에러 복구
const controller = useRef<AbortController | null>(null)
const { state, questions, start, cancel, retry } = useAiWizard('/api/ai/generate-questions')

return (
  <>
    {state === 'streaming' && (
      <>
        <SkeletonAI />
        <Button variant="outline" size="sm" onClick={cancel}>{t('ai.cancel')}</Button>
      </>
    )}
    {state === 'error' && (
      <ErrorBoundaryFallback
        title={t('ai.error.title')}
        description={t('ai.error.description', { reason: state.reason })}
        action={{ label: t('ai.retry'), onClick: retry }}
      />
    )}
    {state === 'done' && <AiResultBlock source="gemini" questions={questions} />}
  </>
)
```

```tsx
// AI 결과 블록 — 책임 표식
<AiResultBlock source="gemini">
  <Sparkles aria-hidden="true" className="text-[--color-text-info-on]" />
  <p className="text-xs text-[--color-text-muted]">{t('ai.draftNotice')}</p>
  {children}
</AiResultBlock>
```

## 로드맵

| 항목 | M/S/C/W | Phase | 대상 |
|---|---|---|---|
| `/api/ai/*` 스트리밍 응답으로 전환 | Must | P1 | 3 엔드포인트 |
| 취소(`AbortController`) 지원 | Must | P1 | wizard-panel, ai-comment, ai-open-analysis |
| `SkeletonAI` + 책임 표식 `AiResultBlock` | Must | P1 | 신규 pattern |
| 실패 복구 (3요소 카피, 재시도) | Must | P1 | 전 엔드포인트 |
| `GEMINI_API_KEY` 미설정 EmptyState | Must | P1 | `/admin/settings/gemini-settings.tsx` 연결 |
| Invisible 경계 명확화 문서 (어디서 표식 쓸지) | Should | P2 | 07 |
| 관측 지표 수집 (지연, 취소율, 첫 토큰) | Should | P2 | API 라우트 |
| 사용자별 일일 한도 훅 | Could | P3 | 서버 |
| AI 생성 문구 톤 가이드 (`06` 연동) | Could | P3 | `06-ux-writing.md` |

## 수용지표

**정량**
- 3개 AI 엔드포인트 중 스트리밍 전환 완료 수: 3/3 (Phase 1 말).
- 취소 가능 UI 를 가진 AI 호출 지점 수: 3/3.
- AI 결과 블록에 책임 표식(`AiResultBlock`) 사용 비율: 100%.
- 첫 토큰까지 p95: < 1.5s.
- AI 호출 실패 시 사용자가 취한 후속 행동(재시도/수동 입력) 비율: ≥ 60% (이탈보다 회복).

**정성**
- 사용자가 "기다리는 중" 인지 "결과를 보고 있는 중" 인지 혼동하지 않는다.
- AI 생성 초안을 "내 것" 으로 만들기 전에 한 번은 확인한다.

## 체크리스트

- [ ] 엔드포인트가 스트리밍을 제공한다.
- [ ] 클라이언트가 취소 가능하다 (AbortController + UI).
- [ ] 실패 시 3요소 카피 + 재시도 CTA 가 있다.
- [ ] 결과 블록에 `AiResultBlock` (책임 표식) 을 사용했다.
- [ ] Invisible 경계(표식 없음) 판단을 문서에 기록했다.
- [ ] 관측 로그(입·출력 토큰, 지연, 취소) 를 남긴다.
- [ ] `GEMINI_API_KEY` 미설정 폴백 UI 가 있다.

## 관련 문서

- 상류: [01-principles.md](./01-principles.md) §A5/B4, [03-components.md](./03-components.md)
- 하류: [06-ux-writing.md](./06-ux-writing.md), [08-accessibility.md](./08-accessibility.md)

_라우팅 스코프: 실사용만 (`/admin/*` 의 AI 패널 · `/api/ai/*`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | 스트리밍·Invisible 경계·책임 표식 정의 |
