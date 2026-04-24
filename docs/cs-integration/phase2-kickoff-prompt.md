# Phase 2 Kickoff — 새 세션 시작 프롬프트

> **새 Claude Code 세션에서 이 파일만 읽고 바로 이어갈 수 있도록 설계됨.**
> 복잡한 프롬프트 대신 이 경로만 가리키면 됨: `docs/cs-integration/phase2-kickoff-prompt.md`.

**작성일**: 2026-04-17 · 갱신: 2026-04-20 (Session 1 prep 완료)
**선행**: Phase 1 ✅ 완료 (production live, main `a6e3a1f`) · Session 1 prep ✅ (key 회전, E2E 8/8 against production)

---

## 사용자가 새 세션에 붙여넣을 프롬프트 (복사용)

```
survey_sd 에서 작업. docs/cs-integration/phase2-kickoff-prompt.md 를 먼저 읽고 Phase 2 착수 준비부터 시작해.
```

또는 짧게:
```
Phase 2 착수. docs/cs-integration/phase2-kickoff-prompt.md 참고.
```

---

## 1. 현재까지 확정된 것 (2026-04-20 EOD)

### 구조
- 3 섬: 로컬 v2 HTML (BRIS 수집) · Supabase `cs_*` 파이프라인 (DB only) · survey_sd 앱 (Vercel)
- "다른 도구" = `02. 대상자관리/참고/cs_dashboard.html` (anon Supabase client)
- 실운영 설문 테이블 = **`edu_surveys`** (uuid), `surveys`(int)는 legacy

### Phase 1 성과 (끝)
- **Production endpoint live**: `POST https://exc-survey.vercel.app/api/distributions/cs-bridge`
- DB 스키마 확장 완료 (마이그레이션 028):
  - `cs_survey_targets` +6 컬럼 (distribution_id, survey_token, survey_url, dispatched_at, dispatch_channel, dispatch_error)
  - `distribution_batches` +source / source_batch_id
  - `cs_target_batches.survey_id` FK → edu_surveys(id)
- Playwright E2E `e2e/cs-bridge.spec.ts` **8/8 against production 확정** (2026-04-20 Session 1)
- `cs_dashboard.html` 의 `BRIDGE_KEY` 에 production 값 주입됨 → "설문 발송" 버튼 실 운영 가능
- ADR 1~8 확정 (decisions.md)

### Session 1 prep 성과 (2026-04-20, 코드 변경 없음)
- `CS_BRIDGE_API_KEY` 전체 회전 (3곳: Vercel prod env · `.env.local` · `cs_dashboard.html`). 재배포 `dpl_B8dj9pFuoDutFFpUTFVwcD5j5Ptr`.
- E2E 5/8 실패(401) 진단 → 로컬 `.env.local` 값만 stale, 회귀 아님. kickoff §3 "E2E 8/8 상시 검증" 문구가 이제 실제로 성립 (production 대상).
- Supabase cs_* 드리프트 없음 (kickoff §3 점검 완료)
- 상세: [`worklog/2026-04-20-phase2-prep.md`](./worklog/2026-04-20-phase2-prep.md)

### ADR 요약 (Phase 2 직결)
- **ADR-007**: `cs_*` 접근은 Supabase client 단일 (Prisma 모델 추가 X)
- **ADR-008**: 실운영 설문 = `edu_surveys`, Prisma `Survey`/`Distribution` legacy

---

## 2. Phase 2 목표 (docs/cs-integration/phase2-spec.md)

**survey_sd 안으로 대상자 관리 점진 흡수.** 로컬 cs_dashboard.html 은 유지, 앱 쪽 UI가 주 운영 도구가 되도록.

### 스코프
1. `/admin/cs-targets` — 배치 목록·상세·발송 UI (4-5 페이지)
2. `/admin/cs-dashboard` — v_cs_system_health 등 뷰 활용 대시보드
3. 응답 submit hook → `cs_survey_participation` / `cs_dispatch_records` writeback
4. RLS 재정비 (anon vs authenticated 분리)
5. `cs_dashboard.html` deprecation 안내 (삭제 X, 앱 우선)

### 스코프 아웃
- Prisma `cs_*` 모델 추가 (ADR-007 — Supabase client 유지)
- BRIS 수집 서버 이관 (Phase 3)

### 예상 공수 ≈ 1.5주

---

## 3. 새 세션 시작 프로토콜 (Claude 읽기 순서)

1. **`docs/cs-integration/context.md`** — 섬 구조, 제약, 용어
2. **`docs/cs-integration/decisions.md`** — ADR 1~8 (특히 007, 008)
3. **`docs/cs-integration/phase2-spec.md`** — Phase 2 전체 설계
4. **`docs/cs-integration/worklog/INDEX.md`** — 세션 히스토리
5. (이 파일) **`phase2-kickoff-prompt.md`** — 지금 읽고 있는 거

실행 계획 세우기 전 필수 점검 (Session 1에서 완료 — 회귀만 재확인):
- [x] ~~main HEAD 확인~~ — Session 1 끝 기준 `a6e3a1f` + 이 세션 handoff PR
- [x] ~~E2E 8/8~~ — 2026-04-20 against production 통과 확인됨. **다시 실행해 회귀만 체크** (`npx playwright test e2e/cs-bridge.spec.ts`).
- [x] ~~Supabase cs_* 행수~~ — 80 targets 유지. 증가 시 Session 1 이후 실 발송 있었다는 뜻이므로 worklog 확인.

---

## 4. 착수 결정 필요한 Open Items (Session 1 이후 갱신)

| # | 항목 | 상태 (2026-04-20) | 해결 위치 |
|---|---|---|---|
| O1 | Vercel env `NEXT_PUBLIC_APP_URL` literal `\n` 제거 | 미해결 (코드 방어 중, blocker 아님) | Vercel Dashboard 5분 |
| O2 | `cs_target_batches.survey_id` 지정 UI | 미해결 (여전히 SQL UPDATE 필요) | Phase 2 UI 신규 (§3-2) |
| O3 | cs_dashboard.html anon 의 `cs_survey_targets` 확장 컬럼 update 실전 검증 | 미수행 (Option B 안전 이슈로 보류) | 아래 §5 Option B 경로 결정 후 |
| O4 | O1 중복 | — | — |
| **O5** | **Option B 실행 시 실 고객 이메일 송신 위험** | **신규 — Session 1에서 발견** | §5 참조 |

---

## 5. 제안하는 첫 번째 작업 (Phase 2 Step 1)

### Option B 갱신 — 실 발송 경로에 **실 고객 이메일 송신 위험** (O5)

현재 dispatch 가능한 유일 배치 `cc14004b` ("테스트_4월2차")의 eligible 2건이 **실 고객 이메일** (`hjpark@join.co.kr`, `jskim@mma.go.kr`). Bridge는 distributions만 생성하지만 매일 09:00 KST `/api/cron/send-emails` cron이 pending 픽업 → 실 발송. Dashboard 클릭 후 방치 시 실 고객 수신.

**Option B 분기 (다음 세션 결정)**:
- **B1. 안전 배치 신규 seed** — fake `@example.com` 수신자로 batch + targets SQL seed → dashboard 클릭. O3 (anon RLS 확장 컬럼 update) 자연 검증.
- **B2. E2E 8/8을 Option B 대체로 간주** — Session 1에서 production 8/8 확정됨, dashboard 클릭은 시각적 재확인에 불과. surveyUrl 1건 브라우저 접속 smoke만 추가.
- **B3. cc14004b로 진행 + 즉시 cancel** — 발송 직후 distributions `status='cancelled'`. 타이밍 민감 + 실 고객 row 잔존.

**Session 1 추천**: **B2** (E2E가 이미 같은 코드 경로 전부 커버, 빠르게 Option A로).

### Option A: `/admin/cs-targets` 배치 목록 페이지 (UI-first)
- 작은 범위에서 시작 (read-only)
- Supabase client 패턴 검증 (ADR-007)
- Phase 2 §3-1 ~ §3-2 일부 — 1일 예상

**권장 순서**: Option B 경로 합의 (5분) → Option A 착수. B1 선택 시 1일 추가.

---

## 6. 세션 종료 시 업데이트 대상

Phase 2 각 세션 후:
- `worklog/YYYY-MM-DD-*.md` 신규 생성
- `worklog/INDEX.md` 최상단에 한 줄 추가
- 새 결정 있으면 `decisions.md` append (ADR-009~)
- `phase2-spec.md` 살아있는 설계서로 갱신

---

## 7. 주의사항

- **main direct push 차단 정책**: 모든 변경은 PR 통해. 사용자 명시 승인 후 머지.
- **Vercel env 변경**은 새 deploy 필요 (빈 커밋 푸시로 트리거 가능).
- **Supabase 쓰기**는 service_role 우선. anon 은 cs_dashboard.html 용.
- **Next.js 16**이라 기존 지식과 다름. `node_modules/next/dist/docs/` 가이드 우선.

---

## 8. 참고 링크

- Production endpoint: `https://exc-survey.vercel.app/api/distributions/cs-bridge`
- Vercel project: team `daun92s-projects`, project `exc-survey` (id `prj_PgjIppaIsTazIkQxrA63EIlbfBjm`)
- Supabase: `cs-survey` (ref `gdwhbacuzhynvegkfoga`, ap-northeast-2)
- GitHub repo: https://github.com/Daun92/survey_sd
- Phase 1 merge: #72 (squash `7fccef2`), docs: #73 (`e24a6a0`)
- cs_dashboard.html 위치: `D:/00.26년업무/06_CS/02. 대상자관리/참고/cs_dashboard.html`
