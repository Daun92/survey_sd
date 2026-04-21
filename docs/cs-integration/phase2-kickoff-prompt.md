# Phase 2 Kickoff — 새 세션 시작 프롬프트

> **새 Claude Code 세션에서 이 파일만 읽고 바로 이어갈 수 있도록 설계됨.**
> 복잡한 프롬프트 대신 이 경로만 가리키면 됨: `docs/cs-integration/phase2-kickoff-prompt.md`.

**작성일**: 2026-04-17
**선행**: Phase 1 ✅ 완료 (production live, main `e24a6a0`)

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

## 1. 현재까지 확정된 것 (2026-04-17 EOD)

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
- Playwright E2E `e2e/cs-bridge.spec.ts` 8/8 상시 검증 가능
- `cs_dashboard.html` 의 `BRIDGE_KEY` 에 production 값 주입됨 → "설문 발송" 버튼 실 운영 가능
- ADR 1~8 확정 (decisions.md)

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

실행 계획 세우기 전 필수 점검:
- [ ] `git log --oneline -5` 로 main HEAD 확인 (`e24a6a0` 이후 변경 있는지)
- [ ] `npx playwright test e2e/cs-bridge.spec.ts` 가 8/8 통과 (회귀 확인)
- [ ] Supabase `cs_*` 현재 행수 확인 (80 targets 기준에서 증감)

---

## 4. 착수 결정 필요한 Open Items (Phase 1 에서 이월)

| # | 항목 | 해결 위치 |
|---|---|---|
| O1 | Vercel env `NEXT_PUBLIC_APP_URL` literal `\n` 제거 | Dashboard 5분, code 방어 중이므로 blocker 아님 |
| O2 | `cs_target_batches.survey_id` 지정 UI — 현재는 SQL UPDATE | Phase 2 UI 신규 (Section 3-2) |
| O3 | cs_dashboard.html anon 의 `cs_survey_targets` 확장 컬럼 update 실전 검증 | Phase 2 RLS 재정비 전에 실 발송 1회 |
| O4 | `NEXT_PUBLIC_APP_URL` preview 값에도 newline 존재 — PR preview 테스트 영향 | 동 O1 |

---

## 5. 제안하는 첫 번째 작업 (Phase 2 Step 1)

### Option A: `/admin/cs-targets` 배치 목록 페이지 (UI-first)
- 작은 범위에서 시작 (read-only)
- Supabase client 패턴 검증
- 1일 예상

### Option B: 실 운영 발송 1회 검증 (Phase 1 정말로 끝냈는지 확인)
- 배치 1건에 survey_id 세팅 (SQL)
- cs_dashboard.html 로 "설문 발송" 클릭
- DB writeback + surveyUrl 접근 확인
- **이걸 먼저 하지 않으면 Phase 2 내내 Phase 1 품질 의심**

**추천**: **B → A 순서**. 실 운영 검증 1회가 Phase 2 착수 전제 조건.

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
