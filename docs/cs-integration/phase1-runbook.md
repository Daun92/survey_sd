# Phase 1 Runbook — 실행 순서

**상태**: ✅ 완료 · 2026-04-17 (main `7fccef2` production deploy)
**목표**: phase1-spec.md 에 정의된 Phase 1-a 를 **실제 실행 가능한 순서**로 분해.

관련 ADR: ADR-001, ADR-005, ADR-006, ADR-007

---

## 0. 사전 조건

- [x] Git `main` 이 `origin/main` 과 동기 (2026-04-17 확인)
- [x] Vercel production = `main` HEAD (2026-04-17 확인)
- [x] Supabase 프로젝트 `cs-survey` / `gdwhbacuzhynvegkfoga` 접근 가능
- [ ] Vercel CLI 설치 (`npm i -g vercel`) — env pull 필요
- [ ] 로컬 dev 환경 부팅 가능 (`npm run dev` → `http://localhost:3000` 200)

---

## 0.5. 완료 체크리스트 (2026-04-17)

- [x] Step A: 브랜치 · Vercel 링크 · `.env.local` · `CS_BRIDGE_API_KEY` (local)
- [x] Step B: `028_cs_bridge_phase1.sql` (FK 수정 포함 — surveys → edu_surveys)
- [x] Step C: `/api/distributions/cs-bridge` route — Supabase client 단일
- [~] Step D: 단위 테스트 → Step F 통합 (runner 신규 도입 없이 Playwright API test로 커버)
- [x] Step E: Preview 배포 + cs_dashboard 시뮬레이션 E2E (surveyUrl `\n` 버그 fix 2회)
- [x] Step F: Playwright E2E 8/8 (`e2e/cs-bridge.spec.ts`, 4.3s)
- [x] Step G: PR #72 merge → `7fccef2` production → smoke 4/4 → cs_dashboard.html `BRIDGE_KEY` 주입
- [x] Step H: worklog / runbook / INDEX 정리

**Production**: `https://exc-survey.vercel.app/api/distributions/cs-bridge`

---

## 1. 작업 흐름 (최상위)

```
Step A: 브랜치·환경 준비
Step B: DB 마이그레이션 (로컬 검증 → 원격 적용)
Step C: Bridge API 구현
Step D: 단위 테스트
Step E: Preview 배포 + cs_dashboard 수동 테스트
Step F: E2E 테스트 (Playwright)
Step G: Production 롤아웃
Step H: 문서화 + 검증
```

각 Step 은 독립적으로 reviewable (PR 가능하도록).

---

## 2. Step A — 브랜치·환경 준비 (15분)

### A-1. 브랜치 생성
```bash
cd "D:/00.26년업무/06_CS/01.설문관리/survey_sd"
git checkout -b feature/cs-bridge-phase1 main
```

### A-2. 로컬 환경 세팅 (first time only)
`AGENTS.md` 의 "로컬 개발 환경 세팅" 섹션 따라:
```bash
vercel link --yes --project exc-survey
vercel env pull .env.local --environment=preview --yes
vercel env pull .env.development.tmp --environment=development --yes
grep "^CRON_SECRET=" .env.development.tmp >> .env.local
echo 'NEXT_PUBLIC_APP_URL="http://localhost:3000"' >> .env.local
rm .env.development.tmp
npm install
npx prisma generate
```

### A-3. CS_BRIDGE_API_KEY 생성
```bash
# 32바이트 랜덤 hex (64자)
openssl rand -hex 32
```
출력 값을 **어디에도 커밋하지 않고** 보관. Step G 에서 Vercel env로 주입.

로컬 개발용은 `.env.local` 에만 추가:
```
CS_BRIDGE_API_KEY="dev-local-only-32hex..."
```

### A-4. dev 서버 smoke
```bash
npm run dev
# 다른 터미널:
curl -sS http://localhost:3000/api/distributions/cs-bridge -X POST -H 'x-cs-bridge-key: wrong' -d '{}'
# → 현재는 404 (엔드포인트 미존재). Step C 후 401 기대.
```

**완료 기준**: 브랜치 생성, `.env.local` 에 CS_BRIDGE_API_KEY 존재, dev 서버 부팅.

---

## 3. Step B — DB 마이그레이션 (30분)

### B-1. 마이그레이션 파일 작성
`supabase/migrations/20260417120000_cs_bridge_phase1.sql` (정확한 타임스탬프 사용):

```sql
-- =====================================================================
-- Phase 1: cs-bridge 연동 DB 확장
-- =====================================================================
-- 1. cs_survey_targets: bridge writeback 필드 6개
ALTER TABLE public.cs_survey_targets
  ADD COLUMN IF NOT EXISTS distribution_id  uuid REFERENCES public.distributions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS survey_token     varchar(64),
  ADD COLUMN IF NOT EXISTS survey_url       varchar(500),
  ADD COLUMN IF NOT EXISTS dispatched_at    timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_channel varchar(20),
  ADD COLUMN IF NOT EXISTS dispatch_error   text;

CREATE INDEX IF NOT EXISTS idx_cs_targets_distribution ON public.cs_survey_targets(distribution_id);
CREATE INDEX IF NOT EXISTS idx_cs_targets_status       ON public.cs_survey_targets(status);

-- 2. distribution_batches: 출처 추적
ALTER TABLE public.distribution_batches
  ADD COLUMN IF NOT EXISTS source          varchar(40) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_batch_id uuid;

COMMENT ON COLUMN public.distribution_batches.source IS
  'manual | cs-bridge | cs-csv-import — 배부 배치의 생성 경로';
COMMENT ON COLUMN public.distribution_batches.source_batch_id IS
  'source=cs-bridge/csv-import 시 cs_target_batches.id 역참조';

CREATE INDEX IF NOT EXISTS idx_distribution_batches_source_batch
  ON public.distribution_batches(source_batch_id)
  WHERE source_batch_id IS NOT NULL;

-- 3. cs_target_batches: 설문 링크 (bridge 호출 시 필수)
ALTER TABLE public.cs_target_batches
  ADD COLUMN IF NOT EXISTS survey_id uuid REFERENCES public.edu_surveys(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.cs_target_batches.survey_id IS
  'Phase 1: 이 배치가 발송할 설문. bridge API 호출 시 필수.';

-- 4. anon 권한: 신규 컬럼에 update 허용 확인 (기존 policy 가 row-level이면 자동 상속)
-- 필요 시 아래 추가:
-- GRANT UPDATE (distribution_id, survey_token, survey_url, dispatched_at, dispatch_channel, dispatch_error)
--   ON public.cs_survey_targets TO anon, authenticated;
```

### B-2. 로컬(또는 Supabase MCP) 적용
```bash
# Supabase MCP 사용 (더 안전 — 계정 권한 필요)
# - apply_migration 툴로 이 SQL 실행
#   name: "cs_bridge_phase1"
#   query: 위 SQL 전체
```

또는 Supabase Dashboard SQL Editor 에 붙여넣기 (prod 직접 변경 주의 — 미리 preview/branch 확인).

### B-3. 검증 쿼리
```sql
-- 1. 신규 컬럼 존재
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='cs_survey_targets'
  AND column_name IN ('distribution_id','survey_token','survey_url','dispatched_at','dispatch_channel','dispatch_error');
-- → 6 rows

-- 2. distribution_batches 컬럼
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='distribution_batches'
  AND column_name IN ('source','source_batch_id');
-- → 2 rows

-- 3. cs_target_batches.survey_id
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='cs_target_batches'
  AND column_name='survey_id';
-- → 1 row

-- 4. anon update 권한 테스트 (cs_dashboard.html 시뮬레이션)
-- 실제로는 브라우저에서 Supabase client 로 UPDATE 시도하여 확인
```

### B-4. Prisma db pull → 타입 재생성 (distributions FK 때문)
```bash
DB_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | sed 's/^DATABASE_URL=//;s/^"//;s/"$//')
SESSION_URL=$(echo "$DB_URL" | sed 's|:6543/|:5432/|')
# cs_survey_targets 에 distributions FK 생김 — Prisma 모델에 영향 없음 (cs_* 는 미반영 대상)
# distribution_batches 에 source/source_batch_id 추가됨 — DistributionBatch 모델이 Prisma에 있다면 수동 반영
grep "DistributionBatch" prisma/schema.prisma  # 존재 여부 확인
# 만약 있다면:
#   source          String   @default("manual")
#   sourceBatchId   String?  @map("source_batch_id") @db.Uuid
# 수동 추가 후 npx prisma generate
```
`DistributionBatch` 모델 없으면 (Supabase client 접근이면) 이 단계 스킵.

### B-5. 커밋
```bash
git add supabase/migrations/20260417120000_cs_bridge_phase1.sql prisma/schema.prisma
git commit -m "chore: Phase 1 DB schema — cs-bridge writeback columns + distribution source tracking"
```

**완료 기준**: 마이그레이션 적용, 검증 쿼리 4개 통과, Prisma generate 성공.

---

## 4. Step C — Bridge API 구현 (3~4시간)

### C-1. 파일 생성
`src/app/api/distributions/cs-bridge/route.ts`

의존성 준비 (ADR-008에 따라 Supabase client 단일화):
- `@/lib/supabase/admin` — service_role (cs_survey_targets + distributions 모두)
- `zod` — payload 검증
- `nanoid` — unique_token 생성 (이미 project deps)

참고: `src/app/admin/distribute/actions.ts` 의 insert 패턴 참조 (uuid 기반 distributions / distribution_batches)

### C-2. 구현 스켈레톤
```ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';

const BridgeRequest = z.object({
  batchId: z.string().uuid(),
  channel: z.enum(['auto','email','sms']).default('auto'),
  targets: z.array(z.object({
    targetId:   z.string().uuid(),
    contactId:  z.string().uuid().nullable().optional(),
    name:       z.string().nullable().optional(),
    email:      z.string().email().nullable().or(z.literal('')).optional(),
    phone:      z.string().nullable().optional(),
    company:    z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    position:   z.string().nullable().optional(),
    courseId:   z.string().uuid().nullable().optional(),
    projectId:  z.string().uuid().nullable().optional(),
  })).min(1).max(500),
});

export async function POST(req: NextRequest) {
  // 1. bridge key 검증
  const key = req.headers.get('x-cs-bridge-key');
  if (!key || key !== process.env.CS_BRIDGE_API_KEY) {
    return NextResponse.json({ error: 'invalid bridge key' }, { status: 401 });
  }

  // 2. payload 파싱
  const body = await req.json().catch(() => null);
  const parsed = BridgeRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload', issues: parsed.error.format() }, { status: 400 });
  }
  const { batchId, channel, targets } = parsed.data;

  const supa = createAdminClient();

  // 3. 배치 + survey_id 조회
  const { data: batch, error: batchErr } = await supa
    .from('cs_target_batches')
    .select('id, survey_id, batch_name')
    .eq('id', batchId)
    .single();
  if (batchErr || !batch) {
    return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  }
  if (!batch.survey_id) {
    return NextResponse.json({ error: 'batch has no survey_id' }, { status: 400 });
  }

  // 4. cs_survey_targets 재검증
  const targetIds = targets.map(t => t.targetId);
  const { data: dbTargets } = await supa
    .from('cs_survey_targets')
    .select('id, distribution_id, is_eligible, step5_confirmed, contact_id, project_id, course_id')
    .in('id', targetIds)
    .eq('batch_id', batchId);

  const dbMap = new Map((dbTargets ?? []).map(t => [t.id, t]));

  // 5. distribution_batches upsert (source=cs-bridge)
  let distBatch = await prisma.distributionBatch.findFirst({
    where: { sourceBatchId: batchId, source: 'cs-bridge' } as any,
  });
  if (!distBatch) {
    distBatch = await prisma.distributionBatch.create({
      data: {
        surveyId: batch.survey_id,
        channel,
        title: `CS 배치: ${batch.batch_name ?? batch.id}`,
        totalCount: 0,
        sentCount: 0,
        // source, sourceBatchId 는 schema 반영 필요 — Step B-4 에서 선택
      } as any,
    });
    // raw SQL 로 source 반영이 더 안전할 수도
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://exc-survey.vercel.app';
  const results: any[] = [];
  let dispatched = 0, skipped = 0, errors = 0;

  for (const t of targets) {
    const dbt = dbMap.get(t.targetId);
    if (!dbt || !dbt.is_eligible || !dbt.step5_confirmed) {
      results.push({ targetId: t.targetId, status: 'skipped', reason: 'not_eligible' });
      skipped++;
      continue;
    }
    if (dbt.distribution_id) {
      results.push({ targetId: t.targetId, status: 'skipped', reason: 'already_dispatched' });
      skipped++;
      continue;
    }

    // 채널 결정
    let useChannel: 'email' | 'sms';
    if (channel === 'auto') {
      useChannel = t.email ? 'email' : (t.phone ? 'sms' : ('none' as any));
    } else {
      useChannel = channel;
    }
    if (useChannel === ('none' as any)) {
      results.push({ targetId: t.targetId, status: 'skipped', reason: 'no_contact' });
      skipped++;
      continue;
    }

    try {
      const token = nanoid(12);
      const distribution = await prisma.distribution.create({
        data: {
          batchId: distBatch.id,
          surveyId: batch.survey_id,
          recipientName:     t.name ?? null,
          recipientEmail:    t.email ?? null,
          recipientPhone:    t.phone ?? null,
          recipientCompany:  t.company ?? null,
          recipientDepartment: t.department ?? null,
          recipientPosition: t.position ?? null,
          uniqueToken:       token,
          channel:           useChannel,
          status:            'pending',
        },
      });
      const surveyUrl = `${baseUrl}/d/${token}`;
      results.push({
        targetId: t.targetId,
        distributionId: distribution.id,
        token,
        surveyUrl,
        channel: useChannel,
        status: 'dispatched',
      });
      dispatched++;
    } catch (e: any) {
      results.push({ targetId: t.targetId, status: 'error', reason: e.message ?? 'insert_failed' });
      errors++;
    }
  }

  // 6. 카운터 갱신 (distribution_batches.total_count, sent_count — 실제 발송은 cron, 여기선 total만)
  await prisma.distributionBatch.update({
    where: { id: distBatch.id },
    data: { totalCount: { increment: dispatched } },
  });

  return NextResponse.json({ dispatched, skipped, errors, results }, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'allow': 'POST, OPTIONS' } });
}

export async function GET() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 });
}
```

### C-3. 어댑터·유틸 점검
- `src/lib/db.ts` — Prisma client export 확인
- `src/lib/supabase/admin.ts` — `createAdminClient()` export 확인 (없으면 생성)
- `DistributionBatch` 모델 `source` 필드 schema 반영 (Step B-4 에서 처리)

### C-4. smoke test
dev 서버 띄우고:
```bash
BRIDGE_KEY=$(grep ^CS_BRIDGE_API_KEY= .env.local | cut -d= -f2- | tr -d '"')
curl -sS http://localhost:3000/api/distributions/cs-bridge \
  -X POST \
  -H "x-cs-bridge-key: $BRIDGE_KEY" \
  -H 'content-type: application/json' \
  -d '{"batchId":"00000000-0000-0000-0000-000000000000","channel":"auto","targets":[{"targetId":"00000000-0000-0000-0000-000000000000"}]}'
# 기대: 404 batch not found
```

### C-5. 커밋
```bash
git add src/app/api/distributions/cs-bridge/route.ts src/lib/...
git commit -m "feat: cs-bridge API — cs_survey_targets → distributions 승격 엔드포인트"
```

**완료 기준**: 401/400/404/200 응답 경로 smoke 통과, 실제 존재하는 batch 로 수동 호출 시 distributions 생성 확인.

---

## 5. Step D — 단위 테스트 (2시간)

`src/app/api/distributions/cs-bridge/route.test.ts`
- Vitest or Jest (프로젝트 기존 러너 확인 후 선택)
- Prisma·Supabase 모킹 또는 실제 DB 테스트 DB 사용

케이스 (spec §6-1):
- 잘못된 key → 401
- 빈 targets → 400
- 미존재 batchId → 404
- survey_id 없는 batch → 400
- 유효 target 1건 → 200, dispatched=1
- 이미 distribution_id 있는 target → skipped
- email·phone 둘 다 null → skipped no_contact
- 동일 호출 2회 → 2회차는 모두 skipped

**참고**: `package.json` 의 `"scripts"` 에 test runner 정의 확인. 현재 `"test"` script 없으면 신규 도입은 Phase 1 범위 밖으로 이동하고 E2E 만으로 검증.

커밋: `test: cs-bridge API unit tests`

---

## 6. Step E — Preview 배포 + 수동 테스트 (1시간)

### E-1. Vercel Preview 환경변수
Vercel Dashboard → Project `exc-survey` → Settings → Environment Variables:
- `CS_BRIDGE_API_KEY` = (Step A-3 에서 생성한 값 — preview 와 production 같아도 되고 분리해도 됨. **분리 권장**: preview 용 값 새로 생성)
- Scope: **Preview** 체크

### E-2. PR 생성
```bash
git push -u origin feature/cs-bridge-phase1
gh pr create --title "Phase 1: cs-bridge API" --body "$(cat <<'EOF'
## Summary
- DB 마이그레이션 — cs_survey_targets 확장 컬럼 (distribution_id, survey_token, survey_url, dispatched_at, dispatch_channel, dispatch_error)
- distribution_batches.source / source_batch_id
- cs_target_batches.survey_id
- POST /api/distributions/cs-bridge 엔드포인트

관련 문서: docs/cs-integration/phase1-spec.md

## Test plan
- [ ] 단위 테스트 통과
- [ ] Preview에서 cs_dashboard.html 수동 발송 테스트
- [ ] E2E (Playwright) 통과
- [ ] cs_survey_targets writeback 확인
EOF
)"
```

Preview URL 받은 후 env 반영 될 때까지 대기.

### E-3. cs_dashboard.html 수동 테스트 (로컬에서)
1. `02. 대상자관리/참고/cs_dashboard.html` 사본을 만들어서:
   - `BRIDGE_URL` = preview URL + `/api/distributions/cs-bridge`
   - `BRIDGE_KEY` = preview env 값
2. 브라우저로 열기
3. 기존 배치 중 하나에 **테스트용 survey_id 설정** (이 UI 아직 없으면 Supabase dashboard 에서 직접 UPDATE)
4. Step 5 에서 대상자 2명 선택 → "설문 발송" 클릭
5. alert 결과 확인
6. Supabase에서:
   - `cs_survey_targets` 해당 row 의 `distribution_id`, `survey_url`, `dispatched_at` 채워짐
   - `distribution_batches` 에 source='cs-bridge', source_batch_id=batchId 1건
   - `distributions` 2건, unique_token 존재
7. 브라우저에서 survey_url 접속 → 설문 화면 로드 확인

문제 있으면 API 로그 (Vercel Functions Log) 확인 후 고침.

**완료 기준**: cs_dashboard.html 수동 발송 E2E 1회 성공, DB 상태 정합.

---

## 7. Step F — E2E 테스트 (Playwright, 2시간)

`e2e/cs-bridge.spec.ts`:
1. Supabase service_role 로 seed: 
   - survey 1건
   - cs_target_batches 1건 (survey_id 설정)
   - cs_survey_targets 3건 (step5_confirmed=true, is_eligible=true)
2. POST /api/distributions/cs-bridge (CS_BRIDGE_API_KEY 환경변수 사용)
3. 응답 검증 (dispatched=3)
4. DB 검증 (distributions 3건, cs_survey_targets.distribution_id 3개 채워짐)
5. 동일 호출 재실행 → skipped=3
6. 테스트 후 cleanup

```bash
# playwright.config.ts 의 projects 확인
npx playwright test e2e/cs-bridge.spec.ts --reporter=list
```

커밋: `test: e2e — cs-bridge API full flow`

---

## 8. Step G — Production 롤아웃 (30분)

### G-1. PR 리뷰·머지
- 셀프 리뷰
- main 머지 → Vercel 자동 production 배포 시작

### G-2. Production 환경변수
Vercel Dashboard → Settings → Environment Variables:
- `CS_BRIDGE_API_KEY` = (production 용 값, preview 와 분리)
- Scope: **Production**

### G-3. cs_dashboard.html 최종 업데이트
`02. 대상자관리/참고/cs_dashboard.html` (원본):
```js
const BRIDGE_KEY = '<production env 값>';
```
주의: 이 HTML 은 git 추적 안 함(이 디렉토리 자체가 가이드/레퍼런스 위치). **별도 위치로 배포**하거나 `cs_master/` Apache 경로에 업로드. 이 디렉토리 관리 정책은 별도 결정 필요.

### G-4. 운영 검증
- cs_dashboard.html 실제 열기
- 이번 달 신규 배치로 실 발송 1회
- cs_survey_targets writeback 확인
- 사내 메일 서버로 실제 이메일 수신 (cron 09:00 이후)

**완료 기준**: 실 발송 1건 성공, writeback 확인, 응답 수집 시작.

---

## 9. Step H — 문서화 + 검증 (1시간)

- [ ] `docs/cs-integration/worklog/2026-04-??-phase1-complete.md` 작성
- [ ] `phase1-spec.md` 의 체크리스트 전부 tick
- [ ] 운영 매뉴얼 `docs/cs-integration/phase1-runbook.md` (이 파일) 을 "완료"로 표시
- [ ] `decisions.md` 에 Phase 1 완료 ADR 추가
- [ ] Phase 2 작업 개시 가능 여부 공지

---

## 10. 롤백 플랜

### DB
```sql
-- 마이그레이션 역방향
ALTER TABLE public.cs_survey_targets
  DROP COLUMN IF EXISTS distribution_id,
  DROP COLUMN IF EXISTS survey_token,
  DROP COLUMN IF EXISTS survey_url,
  DROP COLUMN IF EXISTS dispatched_at,
  DROP COLUMN IF EXISTS dispatch_channel,
  DROP COLUMN IF EXISTS dispatch_error;

ALTER TABLE public.distribution_batches
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS source_batch_id;

ALTER TABLE public.cs_target_batches
  DROP COLUMN IF EXISTS survey_id;
```

### 코드
```bash
git revert <merge-commit>
git push origin main  # (권한 있는 관리자가)
```

### env
Vercel Settings 에서 `CS_BRIDGE_API_KEY` 삭제.

### cs_dashboard.html
`BRIDGE_KEY` 를 원래 placeholder 로 되돌리거나, dispatchSurvey 버튼 비활성화. 수기 CSV 운영 복귀.

---

## 11. 예상 일정 (1-3일)

| Step | 소요 | 병렬 가능 |
|---|---|---|
| A | 0.25h | — |
| B | 0.5h | — |
| C | 3~4h | — |
| D | 2h | C 이후 |
| E | 1h | D 와 병행 가능 |
| F | 2h | D 후 |
| G | 0.5h | all 후 |
| H | 1h | G 후 |

**실질 1-2일** 작업 + 운영 검증 1일 = **총 2-3일**.

---

## 12. 오픈 이슈 / 실행 중 결정 필요

| # | 결정 시점 | 안 |
|---|---|---|
| D1 | Step B 작성 중 | `cs_dashboard.html` 에 survey_id 지정 UI 없음 → 첫 테스트는 Supabase SQL 로 직접 UPDATE. 운영 이양 전 UI 추가 |
| D2 | Step C 중 | `DistributionBatch.source` 필드를 Prisma 모델에 추가 vs raw SQL UPDATE. 안전한 쪽은 Prisma 모델 업데이트 |
| D3 | Step C 중 | unique 제약 추가할지 — distributions (batch_id, recipient_email) / cs_survey_targets (batch_id, distribution_id) |
| D4 | Step D | 테스트 러너 선택 (기존 프로젝트 설정 따르기) |
| D5 | Step G | `02. 대상자관리/참고/cs_dashboard.html` 의 배포 위치 (onepage.exc.co.kr? 내부망 공유드라이브?) |

실행 중 발견되는 결정은 `decisions.md` 에 ADR 추가.
