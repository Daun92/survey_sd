# 10. 로드맵 — Phase 1 / 2 / 3 과 수용지표 집계

> **핵심 원칙.** 리모델링은 *한 번에 다시 그리는* 일이 아니라 *원칙 · 토큰 · 컴포넌트 · 경험 · 라이팅 · 프로세스* 를 의존성 순으로 **점진 이식** 하는 일이다 (TDS Progressive Enhancement).

## 의존성 그래프

```
01 원칙 ──┬──▶ 02 토큰 ──┬──▶ 03 컴포넌트 ──┬──▶ 04 응답자 UX
          │              │                   │
          │              │                   ├──▶ 05 관리자 UX
          │              │                   │
          │              │                   └──▶ 07 AI 패턴
          │              │
          │              └──▶ 08 접근성 (교차: 전 문서)
          │
          ├──▶ 06 UX 라이팅 (03·04·05·07 과 동시 진행 가능)
          │
          └──▶ 09 PRD 프레임워크 (프로세스, 모든 Phase)

00 overview / 99 glossary — Living, 매 PR 동반 갱신
```

원칙(`01`)은 Phase 1 시작 전에 합의. 토큰(`02`) 이 컴포넌트(`03`) 보다 먼저. 컴포넌트가 응답자/관리자 UX(`04`/`05`) 의 재료. AI(`07`) 는 컴포넌트 pattern 과 라이팅(`06`) 을 재료로. 접근성(`08`) 은 모든 층에 얹힌다.

## Phase 1 — 기초 공사 (2주)

**테마**: 원칙 공표 · 토큰 semantic 층 · 중복 제거 · 루트 UX 정상화.

| # | 항목 | 담당 문서 | 대상 파일 |
|---|---|---|---|
| 1 | 원칙 A~D 팀 합의·PR 템플릿 반영 | 01 | `.github/pull_request_template.md` |
| 2 | semantic 토큰 ≥ 12개 정의 (action/surface/text/border/status × 역할) | 02 | `src/app/globals.css` |
| 3 | `.expert-theme` 스코프에 semantic alias 추가 | 02 | `src/app/globals.css:120-151` |
| 4 | 상태 배지 3색 치환 (opened/started/completed) | 02, 05 | `src/app/admin/distribute/distribute-tabs.tsx:111-113` |
| 5 | 루트 에러·404 컴포넌트 `ErrorBoundaryFallback` 이식 | 03, 06 | `src/app/error.tsx`, `src/app/not-found.tsx` |
| 6 | `CompletionScreen` 신규 + `/s`·`/d` 이식 | 03, 04, 06 | `src/app/s/[token]/page.tsx:43-55`, `src/app/d/[token]/page.tsx:62-98` |
| 7 | 응답자 라우트 `loading.tsx`·`error.tsx` | 04 | `/s`, `/d`, `/hrd` 각각 |
| 8 | `SurveyBottomNav` safe-area 적용 | 04 | `src/components/respond/survey-bottom-nav.tsx` |
| 9 | `src/messages/ko/` skeleton + error/respondent 카피 이관 | 06 | `src/messages/ko/{index,error,respondent,shared}.ts` |
| 10 | `docs/prd/` 스캐폴딩 + 레거시 `docs/PRD.md` 상단 배너 | 09 | `docs/prd/*`, `docs/PRD.md` |
| 11 | `/api/ai/*` 스트리밍 전환 + 취소 지원 | 07 | `src/app/api/ai/*`, `src/components/survey/wizard-panel.tsx` |
| 12 | `--color-focus-ring` + `prefers-reduced-motion` 전역 분기 | 08 | `src/app/globals.css` |

**Phase 1 종료 조건**
- semantic 토큰 ≥ 12개 등록 + Tailwind 자동 utility 동작.
- `/admin/distribute` 상태 배지 raw palette 0건.
- `/s`, `/d`, `/hrd` 각 경로에 `loading.tsx`·`error.tsx` 존재 (6/6).
- 중복 CompletionScreen 구현 2 → 1.
- `src/messages/ko/` 에 ≥ 40 키 등록.
- `docs/prd/templates/prd.md` 기반 신규 PRD ≥ 1건 작성.

## Phase 2 — 확산 (4주)

**테마**: hardcoded 색 일괄 치환 · 자동저장 이식 · 빈상태/확인 다이얼로그 · 스트리밍 UX 정착 · a11y 1차 감사.

| # | 항목 | 담당 문서 | 대상 |
|---|---|---|---|
| 1 | 테이블·카드·버튼 raw palette 치환 (admin 전역) | 02, 05 | `/admin/*` 466건 → < 80건 |
| 2 | `INTRO_STYLE_MAP` 토큰화 (섹션 인트로 8색) | 02, 04 | `src/app/s/[token]/survey-form.tsx:80-93` |
| 3 | `useAutoSave` 훅 공용화 · `/s`, `/d` 이식 | 04 | 신규 훅 + 기존 `/hrd` 로직 재활용 |
| 4 | `useOptimistic` — 답변 저장·섹션 이동 | 04 | `/s`, `/d`, `/hrd` |
| 5 | 섹션 전환 애니메이션 + reduced-motion | 04 | `SurveyForm` |
| 6 | `EmptyState`, `ConfirmDialog` pattern 이식 | 03, 05 | admin 전역 |
| 7 | admin 라우트별 `loading.tsx`·`error.tsx` | 05 | `/admin/surveys`, `/admin/distribute`, `/admin/reports`, `/admin/responses/[surveyId]` |
| 8 | 차트 팔레트 `--chart-*` semantic 재정의 | 02, 05 | `src/app/globals.css`, `src/components/charts/*` |
| 9 | `AiResultBlock` 책임 표식 적용 (`ai-comment`, `ai-open-analysis`, `wizard-panel`) | 07 | admin AI 지점 3곳 |
| 10 | `GEMINI_API_KEY` 미설정 EmptyState 폴백 | 07 | `src/app/admin/settings/gemini-settings.tsx` 연동 |
| 11 | Playwright axe 프로젝트 + CI 게이트 | 08 | `playwright.config.ts` |
| 12 | Raw palette lint 규칙 + CI 실패 처리 | 02 | ESLint |
| 13 | PR 템플릿에 엣지 케이스 §D 체크리스트 편입 | 09 | `.github/pull_request_template.md` |
| 14 | 카피 톤 매트릭스 확정 + `admin.ts` 카탈로그 분리 | 06 | `src/messages/ko/admin.ts` |
| 15 | 다이얼로그·Sheet 포커스 트랩 공통 훅 | 08 | `src/components/ui/{dialog,sheet}.tsx` |

**Phase 2 종료 조건**
- `/admin/*` raw palette grep 히트 < 80.
- 자동저장 보유 응답자 경로 3/3.
- Playwright axe CI 게이트 통과.
- AI 지점 3곳 모두 스트리밍 + 취소 + 책임 표식.
- PR 템플릿이 엣지 케이스를 강제.

## Phase 3 — 정착 (지속)

**테마**: 카탈로그 · 프로세스 · 측정 · 잔여 정리.

| # | 항목 | 담당 문서 | 대상 |
|---|---|---|---|
| 1 | `/admin/_catalog` MDX 페이지 | 03 | 신규 라우트 |
| 2 | primitive `@designStatus` JSDoc 부착 | 03 | `src/components/ui/*` |
| 3 | Raw palette 잔여 정리 (< 15건) | 02, 05 | admin 전역 |
| 4 | Arbitrary spacing 감축 (-80%) | 02 | admin 전역 |
| 5 | 빌더 단축키 + `?` 도움말 모달 | 05 | `BuilderShell` |
| 6 | 키보드 `visualViewport` 대응 | 04 | iOS Safari |
| 7 | 수동 QA 체크리스트 릴리즈 템플릿 | 08 | 릴리즈 |
| 8 | Outcome 섹션 작성 가이드 (리포트 연동) | 09 | `docs/prd/` |
| 9 | AI 일일 한도 훅 · 관측 지표 | 07 | `/api/ai/*` |
| 10 | `ProgressDots` vs `ProgressBar` A/B | 04 | `/s` |

## 수용지표 — 통합 대시보드

| 축 | 지표 | 현재 (2026-04-21) | P1 말 | P2 말 | P3 말 |
|---|---|---|---|---|---|
| 토큰 | raw palette grep (`/admin/*`) | 466 | < 350 | < 80 | < 15 |
| 토큰 | semantic 토큰 등록 수 | 0 (시스템화 전) | ≥ 12 | ≥ 20 | ≥ 28 |
| 컴포넌트 | `CompletionScreen` 중복 구현 | 3~4 | 1 | 1 | 1 |
| 컴포넌트 | `<Button>` className 색 override | (측정) | 0 | 0 | 0 |
| 응답자 | 자동저장 보유 경로 | 1 (/hrd) | 1 | 3 | 3 |
| 응답자 | loading/error.tsx 보유 경로 | 0 | 3 | 3 | 3 |
| 응답자 | Lighthouse Mobile A11y p75 | — | ≥ 90 | ≥ 95 | ≥ 95 |
| 응답자 | INP p75 | — | < 300ms | < 200ms | < 200ms |
| AI | 스트리밍 전환 엔드포인트 | 0 / 3 | 3 / 3 | 3 / 3 | 3 / 3 |
| AI | 첫 토큰 p95 | — | < 2s | < 1.5s | < 1.5s |
| 라이팅 | `src/messages/ko/` 키 수 | 0 (폴더 없음) | ≥ 40 | ≥ 120 | ≥ 200 |
| 라이팅 | 카탈로그 경유 노출 문자열 비율 | 0% | ≥ 50% | ≥ 80% | ≥ 95% |
| 접근성 | axe serious/critical 위반 | (측정) | 허용 | 0 (CI 게이트) | 0 |
| 접근성 | aria-label 누락 아이콘 버튼 | (측정) | 감소 | 0 | 0 |
| PRD | `docs/prd/active/` 개수 | 0 | ≥ 1 | ≥ 3 | 지속 증가 |
| PRD | PR 에 PRD 링크 첨부율 | 0% | 측정 | ≥ 80% | ≥ 90% |

## 리스크 & 롤백

| 리스크 | 영향 | 완화 |
|---|---|---|
| semantic 토큰 이름 충돌로 시각 회귀 | 관리자 UI 색 어긋남 | 치환 PR 을 라우트 단위로 쪼개고 프리뷰 배포에서 스크린샷 비교 |
| `.expert-theme` alias 누락 | 응답자 페이지 색 깨짐 | P1 에 `.expert-theme` 전용 E2E 스모크 추가 |
| AI 스트리밍 중 취소 미완 → 좀비 요청 | 비용·레이트 | `AbortController` + 서버 abort 신호 처리 테스트 |
| 자동저장 훅 쓰기 폭주 | Supabase 한도 | 디바운스 800ms + 동일 답변 skip |
| 레거시 `docs/PRD.md` 검색 유실 | 지식 공백 | 이관 배너 + 요약본 유지, archive 링크 제공 |

롤백 절차: Phase 내 독립 PR 단위로 revert 가능. 토큰 변경은 별도 PR 로 고립시킨다.

## 운영 규칙

- **매 PR**: 관련 문서(`0N-*.md`) 의 `## 변경 이력` 에 1줄 추가.
- **격주 30분 디자인 리뷰**: 오픈 RFC 검토 + 이 페이지 수용지표 업데이트.
- **분기 1회 측정**: 이 페이지의 "통합 대시보드" 수치를 실제값으로 갱신.

## 관련 문서

- 상류: [00-overview.md](./00-overview.md), [01-principles.md](./01-principles.md)
- 하류: 전 문서의 로드맵 섹션이 이곳으로 집계됨

_라우팅 스코프: 실사용만 (`/admin/*`, `/s`, `/d`, `/hrd`)._

## 변경 이력

| 날짜 | 주제 | 비고 |
|---|---|---|
| 2026-04-21 | 초기 작성 | Phase 1/2/3 · 통합 대시보드 · 리스크 정의 |
