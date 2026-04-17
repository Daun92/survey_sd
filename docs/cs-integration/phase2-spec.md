# Phase 2 Spec — survey_sd 안으로 대상자 관리 흡수

**상태**: Draft · 2026-04-17
**목표**: `cs_dashboard.html`의 핵심 운영 기능을 survey_sd 앱으로 이전. 로그인·RLS·응답 writeback을 통합 관리.

관련 ADR: ADR-001, ADR-002, ADR-005

**선행 조건**: Phase 1 완료 (cs-bridge API 가 작동, cs_survey_targets 확장 컬럼 존재)

**접근 원칙**: ADR-007에 따라 `cs_*` 은 **Supabase client** 로 접근 (Prisma 모델 추가 안 함). B안 작업과 독립.

---

## 1. 산출물 체크리스트

- [ ] Supabase TS 타입 재생성 (`supabase gen types`) — cs_* 모두 커버
- [ ] `/admin/cs-targets` 섹션 — 배치 목록·상세·발송 UI (4-5 페이지)
- [ ] `/admin/cs-dashboard` — 대시보드 (v_cs_system_health 등 뷰 활용)
- [ ] 응답 submit hook — `cs_survey_participation` 업데이트 + `cs_survey_targets.response_*` 반영
- [ ] `cs_dispatch_records` 로그 기록 (bridge API 시·응답 시)
- [ ] RLS 정리 — anon (cs_dashboard.html) vs authenticated (앱) 분리
- [ ] `cs_dashboard.html` deprecation 안내 (UI 문구 + 리다이렉트 배너)
- [ ] 문서 — `phase2-runbook.md`, `cs-targets-ui-guide.md`

---

## 2. 타입 세이프 접근 (Prisma 아님)

ADR-007 에 따라 `cs_*` 은 **Supabase client** 사용. Prisma 스키마 변경 없음.

### 2-1. Supabase TS 타입 생성
```bash
# 통상 스크립트가 있으면 재사용. 없으면 신규:
npx supabase gen types typescript \
  --project-id gdwhbacuzhynvegkfoga \
  --schema public \
  > src/lib/supabase/database.types.ts
```

Phase 1 마이그레이션이 끝난 다음 실행하면 `cs_survey_targets` 확장 컬럼·`distribution_batches.source` 등이 타입에 반영됨.

### 2-2. 클라이언트 유틸
기존 유틸 재사용:
- `src/lib/supabase/admin.ts` — service_role (서버측, RLS 우회)
- `src/lib/supabase/server.ts` — cookie 세션 (서버 컴포넌트·server action)
- `src/lib/supabase/client.ts` — 브라우저

예:
```ts
import { createClient } from '@/lib/supabase/server';
const sb = await createClient();
const { data: batches } = await sb
  .from('cs_target_batches')
  .select('*, survey:surveys(id,title)')
  .order('created_at', { ascending: false });
```

### 2-3. 뷰 활용
복잡한 조인은 DB의 기존 뷰(`v_cs_batch_dashboard`, `v_cs_target_detail` 등) 재사용 권장 — cs_dashboard.html 과 코드 공유됨.

### 2-4. 하이브리드 접근 (distributions / surveys 는 Prisma)
기존 Prisma 12 모델은 계속 Prisma 사용. bridge API에서 distributions insert 시:
```ts
import { prisma } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';

const supa = createAdminClient();
// cs_* 조회·업데이트: supa.from('cs_survey_targets')...
// distributions insert: prisma.distribution.create(...)
```

---

## 3. 신규 페이지

### 3-1. `/admin/cs-targets` — 배치 목록
- 데이터: `v_cs_batch_dashboard` (읽기)
- 컬럼: 배치명, 기간, 상태, 대상자 수, 확정/제외/발송 카운트, 응답률, 연결 설문, 생성일
- 행 클릭 → `/admin/cs-targets/[batchId]`
- 상단 필터: 상태, 기간
- 액션: "새 배치 생성" (Phase 2-b — 우선은 cs_dashboard에서 생성)

### 3-2. `/admin/cs-targets/[batchId]` — 배치 상세
- 데이터: `cs_target_batches` + `v_cs_target_detail` (JOIN cs_survey_targets + cs_contacts + cs_business_places + cs_companies + cs_courses + cs_projects)
- 섹션:
  1. 배치 헤더 — 이름·기간·survey·상태
  2. 5단계 상태 바 (step1~5 각 통과·미통과 건수)
  3. 대상자 목록 — 행별 체크박스, 5단계 상태 배지, 담당자·회사·과정·연락처
  4. 액션 버튼: "설문 발송" (cs-bridge 내부 호출), "CSV 내보내기" (감사용), "배치 확정/취소"
- **발송 플로우**: 체크박스 선택 → "설문 발송" → 서버 action → bridge API (Phase 1) 로 위임 → 결과 토스트 + refetch

### 3-3. `/admin/cs-targets/[batchId]/dispatch` — 발송 결과 상세 (optional)
- 최근 발송의 results[] 리스트 (dispatched / skipped / errors)
- 재발송 버튼 (error 건만)

### 3-4. `/admin/cs-dashboard` — 시스템 현황
- `v_cs_system_health` — 데이터 건전성 (동기화 지연·누락·FK 오류)
- `v_cs_dispatch_summary` — 배치별 발송·응답 요약
- 최근 30일 응답률 추이 차트

### 3-5. `/admin/cs-data/projects` · `/admin/cs-data/contacts` (optional, 읽기 전용)
- cs_dashboard 의 "프로젝트"·"담당자 DB" 탭 대응
- 편집은 당분간 cs_dashboard 에서

### 3-6. 라우팅
- `src/app/admin/cs-targets/page.tsx`
- `src/app/admin/cs-targets/[batchId]/page.tsx`
- `src/app/admin/cs-dashboard/page.tsx`
- 사이드바에 "CS 대상자" 섹션 추가

---

## 4. 응답 수신 Writeback

### 4-1. Submit hook
`src/app/api/surveys/[id]/submit/route.ts` 에서 응답 저장 완료 후:

```ts
// 1. distribution_id 로 cs_survey_targets 역조회
const target = await db.csSurveyTarget.findFirst({
  where: { distribution_id: distribution.id }
});
if (!target) return; // cs 경로 아닌 일반 응답

// 2. cs_survey_participation upsert (6개월 중복방지 소스)
await db.csSurveyParticipation.upsert({
  where: { contact_id_project_id_survey_type: {
    contact_id:  target.contact_id,
    project_id:  target.project_id,
    survey_type: 'post_training'
  }},
  create: {
    contact_id:  target.contact_id,
    project_id:  target.project_id,
    survey_type: 'post_training',
    survey_date: new Date(),
    response_status: 'responded',
    responded_at: new Date()
  },
  update: {
    responded_at: new Date(),
    response_status: 'responded'
  }
});

// 3. cs_dispatch_records 로그
await db.csDispatchRecord.create({
  data: {
    batch_id: target.batch_id,
    project_id: target.project_id,
    contact_id: target.contact_id,
    course_id: target.course_id,
    channel: target.dispatch_channel,
    // (survey_url 등은 distributions에서 이미 참조 가능)
    status: 'responded',
    sent_at: target.dispatched_at,
    // responded_at 등
  }
});
```

### 4-2. Open tracking (optional)
Distribution opened 시 `cs_survey_targets.opened_at` writeback (DB 트리거 or submit 경로에서).

---

## 5. RLS 재정비

### 5-1. 원칙
- **anon 키**: cs_dashboard.html용. `SELECT` 위주 + 제한적 `UPDATE` (대상자 확정, 발송 상태 writeback). 신규 INSERT/DELETE는 막음.
- **authenticated (앱 사용자)**: 관리자 대시보드용. 본인 조직 범위 내 전체 CRUD.
- **service_role (cron, server actions)**: 모든 작업.

### 5-2. 구현
- Phase 2 마이그레이션에서 기존 policy 재작성
- `cs_*` 각 테이블에 `auth.uid()` 체크 + `user_roles` 참조 policy 추가

### 5-3. 검증
- cs_dashboard.html 로드 후 주요 버튼 정상 작동 확인 (anon 경로)
- 앱 로그인 후 /admin/cs-targets 로드 및 발송 정상 (authenticated)

---

## 6. cs_dashboard.html 전환 전략

### 6-1. 유지
- Phase 2 완료 후에도 **cs_dashboard.html은 남김** (BRIS 수집·5단계 편집이 앱으로 완전히 이관되기 전까지)
- 상단 배너 추가: "새 관리 화면이 `/admin/cs-targets` 에 있습니다" + 링크

### 6-2. 점진 이관
Phase 2 끝날 때 앱의 `/admin/cs-targets` 가 아래를 커버:
- 배치 목록·상세·발송
- 응답률 조회

cs_dashboard.html에만 남는 것:
- 5단계 step 자동 스캔 (scanStep1 등) — BRIS 연동 로직이라 사내망 브라우저 전용
- 6개월 발송이력 CSV import
- 프로젝트·담당자 DB 편집

→ Phase 3 에서 사내망 문제 해결 시 전부 앱으로

---

## 7. 테스트 계획

### 7-1. 단위
- `cs-targets` 페이지 로더·server action 테스트
- Submit hook의 cs_* writeback 테스트
- RLS policy 테스트 (anon vs authenticated 권한 차이)

### 7-2. E2E (Playwright)
`e2e/cs-targets-flow.spec.ts`
1. 테스트 유저 로그인 → `/admin/cs-targets`
2. 배치 1건 클릭 → 상세
3. 대상자 2명 체크 → "설문 발송" → 성공 토스트
4. 응답 제출 시뮬레이션 (API 직접 호출)
5. `cs_survey_participation`, `cs_survey_targets.response_*`, `cs_dispatch_records` 확인

### 7-3. 병행 운영 테스트
- cs_dashboard.html 에서 대상자 선정 후 새 앱의 /admin/cs-targets 에서 발송 → 양쪽 잘 보이는지
- 반대로 앱에서 발송 후 cs_dashboard 에서 응답 상태 확인

---

## 8. 스코프 경계

### 포함
- Phase 2 위 1~7 항목
- Prisma 스키마 동기화 (cs_* 범위)

### 제외 (Phase 3)
- BRIS 수집 서버 이관
- 5단계 워크플로우의 자동 스캔 (scanStep1 등)을 앱으로 이관
- 로컬 v2 (localStorage) 저장 계층 제거
- cs_dashboard.html 폐기

### Phase 2 → 3 승격 조건
- `/admin/cs-targets` 가 cs_dashboard 주요 운영 기능 90% 커버
- 응답 writeback 안정 운영 1-2개월
- RLS 정책 이슈 없음
- 사내망 BRIS 접근 방안 확보 (proxy, VPN, 또는 브라우저 쿠키 전달)

---

## 9. 리스크·Open Questions

| # | 항목 | 대응 |
|---|---|---|
| R1 | Prisma 전체 스키마 동기화(B안)와 Phase 2의 순서·충돌 | B안 먼저 완료 후 Phase 2 착수 권장. 또는 Phase 2에서 cs_* 만 부분 동기화. |
| R2 | cs_dashboard.html 의 RLS 의존성을 끊으면 기존 동작 멈춤 | 양쪽 동시 지원 policy 유지. anon update 범위만 축소. |
| R3 | 응답 writeback 중복 (개인링크 재발송 후 응답 시) | `cs_survey_participation` unique(contact_id, project_id, survey_type) 전제 |
| Q1 | `/admin/cs-targets`가 5단계 편집 UI 포함? | 기본 제외. 표시만 하고 편집은 cs_dashboard. 편집 이관은 Phase 3. |
| Q2 | cs_dispatch_records 가 Phase 1 bridge 에서 이미 기록? | Phase 1은 distributions만 생성. dispatch_records 기록은 Phase 2 submit hook에서 하는 게 단일 진실. |
| Q3 | BRIS 수집이 사내망에서만 — Phase 2에 영향? | 영향 없음. Phase 2는 DB 기반 UI·흐름만. 수집은 cs_dashboard 또는 로컬 v2 계속. |

---

## 10. 예상 공수

- Supabase TS 타입 생성 + 유틸 정리: 0.5일
- /admin/cs-targets 4-5 페이지: 5일
- Submit hook writeback: 1일
- RLS 재정비: 2일
- 테스트: 2일
- 문서·검증: 1일

**Total 약 1.5주** (병행 운영 검증 별도). Prisma 작업 제외로 ~2일 단축.
