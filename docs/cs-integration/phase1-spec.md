# Phase 1 Spec — cs-bridge API

**상태**: Draft · 2026-04-17
**목표**: `cs_dashboard.html` → `survey_sd` 실시간 발송 연동. "대상자 확정 → 설문 배부" 단절점 해소.

관련 ADR: ADR-001, ADR-005, ADR-006

---

## 1. 산출물 체크리스트

- [ ] DB 마이그레이션 — `cs_survey_targets` 확장, `distribution_batches` 출처 컬럼, `cs_target_batches`↔`surveys` 링크
- [ ] Bridge API — `POST /api/distributions/cs-bridge` (Node.js runtime)
- [ ] Env — `CS_BRIDGE_API_KEY` (production, preview, development)
- [ ] cs_dashboard.html — `BRIDGE_KEY` placeholder 교체, `SURVEY_ID` 연결 UI 추가 (배치 단위)
- [ ] Phase 1-b (선택) — `/admin/distribute/import-csv` 페이지 (cs_dashboard 비가용 시 수동 대체)
- [ ] 테스트 — API 단위 테스트, Playwright E2E (배치 1건 → 발송 → DB 확인)
- [ ] 문서 — `phase1-runbook.md` (운영 매뉴얼, docs/cs-integration/에 추가)

---

## 2. DB 마이그레이션

파일명 예: `supabase/migrations/20260417_cs_bridge_phase1.sql` (실제 타임스탬프로 교체)

### 2-1. `cs_survey_targets` 확장
```sql
ALTER TABLE public.cs_survey_targets
  ADD COLUMN IF NOT EXISTS distribution_id uuid REFERENCES public.distributions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS survey_token     varchar(64),
  ADD COLUMN IF NOT EXISTS survey_url       varchar(500),
  ADD COLUMN IF NOT EXISTS dispatched_at    timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_channel varchar(20),
  ADD COLUMN IF NOT EXISTS dispatch_error   text;

CREATE INDEX IF NOT EXISTS idx_cs_targets_distribution ON public.cs_survey_targets(distribution_id);
CREATE INDEX IF NOT EXISTS idx_cs_targets_status       ON public.cs_survey_targets(status);
```

### 2-2. `distribution_batches` 출처 추적
```sql
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
```

### 2-3. `cs_target_batches` ↔ survey 링크
배치마다 어떤 설문으로 보낼지 지정해야 함.
```sql
ALTER TABLE public.cs_target_batches
  ADD COLUMN IF NOT EXISTS survey_id uuid REFERENCES public.edu_surveys(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.cs_target_batches.survey_id IS
  'Phase 1: 이 배치가 발송할 설문. bridge API 호출 시 필수.';
```

### 2-4. RLS 정책 (신규 컬럼 write 허용)
`cs_dashboard.html`이 anon 키로 update하므로 기존 policy 가 신규 컬럼에도 적용됨을 확인. 필요 시 해당 컬럼만 update 허용 정책 분리.

```sql
-- 확인만 — 기존 cs_survey_targets.update policy 가 신규 컬럼 포함하는지 \d+ 로 검증
-- 통상 row-level이므로 컬럼 추가만으로 자동 적용. 별도 grant 필요 없음.
```

---

## 3. Bridge API 설계

### 3-1. 경로 · 런타임
- 경로: `src/app/api/distributions/cs-bridge/route.ts`
- 런타임: Node.js (기본 Fluid Compute). Edge 불필요 — DB 커넥션·Prisma 필요.
- 메서드: `POST` (GET/OPTIONS는 405/204)

### 3-2. 인증
```
Header: x-cs-bridge-key: <CS_BRIDGE_API_KEY 값>
```
- `process.env.CS_BRIDGE_API_KEY` 와 정확히 일치할 때만 200 진행
- 불일치 → `401 { error: 'invalid bridge key' }`
- 일치해도 **서버에서 cs_survey_targets 재검증** 필수 (클라이언트 신뢰 금지 — ADR-005 cs_dashboard.html 주석 참조)

### 3-3. 요청 스키마 (Zod)
```ts
const BridgeRequest = z.object({
  batchId: z.string().uuid(),
  channel: z.enum(['auto','email','sms']).default('auto'),
  targets: z.array(z.object({
    targetId:   z.string().uuid(),
    contactId:  z.string().uuid().nullable().optional(),
    name:       z.string().nullable().optional(),
    email:      z.string().email().nullable().optional(),
    phone:      z.string().nullable().optional(),
    company:    z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    position:   z.string().nullable().optional(),
    courseId:   z.string().uuid().nullable().optional(),
    projectId:  z.string().uuid().nullable().optional(),
  })).min(1).max(500),
});
```

### 3-4. 처리 순서
```
1. bridge key 검증
2. payload 파싱 (Zod)
3. cs_target_batches 조회 (id=batchId) → survey_id 확보, 없으면 400
4. 선택된 targets 를 DB에서 재조회 (cs_survey_targets IN targetIds) 
   - WHERE batch_id=batchId AND is_eligible=true AND step5_confirmed=true
   - 누락/불일치 target → skip 목록에 추가 (reason='not_eligible')
5. 이미 distribution_id 있는 target → skip (reason='already_dispatched')
6. distribution_batches upsert (source='cs-bridge', source_batch_id=batchId, survey_id=배치.survey_id)
   - 동일 source_batch_id 로 이미 있으면 재사용
7. 유효한 targets 순회:
   a. recipient 정보 정제 (name/email/phone/company/department/position)
   b. 채널 결정: channel='auto' 이면 email 우선, 없으면 sms, 둘 다 없으면 skip (reason='no_contact')
   c. unique_token 생성 (nanoid 12자)
   d. distributions insert: {batch_id, survey_id, recipient_*, unique_token, channel, status='pending'}
   e. survey URL 조립: `${NEXT_PUBLIC_APP_URL}/d/${unique_token}`
   f. results 배열에 {targetId, distributionId, token, surveyUrl, channel, status:'dispatched'} 푸시
8. 응답 조립: {dispatched, skipped, errors, results[]}
9. 반환 (200)
```

### 3-5. 응답 스키마
```ts
{
  dispatched: number,
  skipped:    number,
  errors:     number,
  results: Array<
    | { targetId, distributionId, token, surveyUrl, channel, status: 'dispatched' }
    | { targetId, status: 'skipped',  reason: 'already_dispatched' | 'no_contact' | 'not_eligible' }
    | { targetId, status: 'error',    reason: string }
  >
}
```

### 3-6. 발송 큐 연결
Phase 1에서는 **distributions 생성까지만**. 기존 cron (`/api/cron/send-emails`, `/api/cron/send-sms`) 가 다음 09:00에 처음 발송.
- 즉시 발송이 필요하면 Phase 1-c로 분리 (같은 route에 `immediate: true` 옵션 추가)

---

## 4. 환경 변수

Vercel Project Settings → Environment Variables:

| 이름 | Production | Preview | Development | 비고 |
|---|---|---|---|---|
| `CS_BRIDGE_API_KEY` | ✓ | ✓ | ✓ | 랜덤 32+ 문자열 (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_APP_URL` | `https://exc-survey.vercel.app` | (preview URL) | `http://localhost:3000` | 설문 URL 조립용. 기존 변수명 재사용 (있으면). |

로컬 `.env.local` 에 동일 키 추가 (gitignored).

### 4-1. cs_dashboard.html 측 설정
`02. 대상자관리/참고/cs_dashboard.html:679`
```js
// before
const BRIDGE_KEY = '__SET_CS_BRIDGE_API_KEY__';
// after
const BRIDGE_KEY = '<Vercel env 와 동일한 실제 값>';
```
주의: anon 배포 HTML이므로 키 평문 노출 불가피. 서버 재검증으로 실질 방어 (cs_survey_targets 권한·상태 체크). Phase 2에서 Supabase auth 기반으로 전환.

---

## 5. cs_dashboard.html 수정 (최소)

| 위치 | 수정 |
|---|---|
| `:679` | `BRIDGE_KEY` placeholder 교체 |
| 배치 생성 UI | `survey_id` 선택 드롭다운 추가 (surveys 테이블 조회 → `cs_target_batches.survey_id` 세팅). **없으면 bridge 호출 시 400** 에러가 나므로 선행 설치 필요. |

배치별 survey_id 지정 UI가 없으면 `sb.from('surveys').select('id,title')` 로 드롭다운 구성. 또는 가장 단순하게 "이 배치의 설문" 을 배치 목록 페이지에서 한 번에 편집.

---

## 6. 테스트 계획

### 6-1. 단위
- `src/app/api/distributions/cs-bridge/route.test.ts`
  - 올바른 key + 유효 payload → 200 + results
  - 잘못된 key → 401
  - 빈 targets → 400
  - 중복 호출 (이미 distributions 존재) → skipped
  - targets.targetId 가 batch에 없음 → skipped reason=not_eligible

### 6-2. E2E (Playwright)
`e2e/cs-bridge.spec.ts` 신규
1. 테스트용 survey + cs_target_batches(survey_id 설정) + cs_survey_targets 3건 (step5_confirmed) 시딩
2. fetch POST /api/distributions/cs-bridge 
3. response.dispatched=3 확인
4. `distribution_batches` 에 source='cs-bridge' + source_batch_id 일치 1건
5. `distributions` 3건, unique_token 존재
6. `cs_survey_targets` 3건 모두 distribution_id·survey_url 채워짐
7. 동일 호출 재실행 → skipped=3, dispatched=0

### 6-3. 통합 (수동, cs_dashboard.html)
1. 로컬에서 `cs_dashboard.html` 열기 (`BRIDGE_URL` 을 `http://localhost:3000/...` 로 임시 변경)
2. 기존 batch 1건 선택, 대상자 2명 체크
3. "설문 발송" 클릭 → alert 성공 메시지
4. cs_survey_targets 의 survey_url 확인 → 브라우저로 열기 → 설문 로드 확인

---

## 7. 배포·롤아웃

```
1. 브랜치: feature/cs-bridge-phase1 (main에서 파생)
2. 마이그레이션 로컬 적용 (supabase mcp apply_migration) → 타입 재생성
3. API 구현 + 단위 테스트
4. PR 생성 → preview 배포
5. preview 환경변수 설정 후 cs_dashboard.html BRIDGE_URL 을 preview URL로 임시 교체하여 수동 테스트
6. main 머지 → production 환경변수 설정 → cs_dashboard.html BRIDGE_KEY 교체 → 운영 검증
7. 운영 검증 완료 시 phase1-runbook.md 작성
```

---

## 8. 스코프 경계

### 포함
- cs-bridge API 구현 (Phase 1-a)
- 관련 DB 스키마 확장
- cs_dashboard.html 최소 수정 (키·survey_id UI)
- 테스트

### 제외 (Phase 2 또는 별도)
- cs_survey_targets 에서 응답률 반영 (Phase 2 응답 submit hook)
- cs_survey_participation 업데이트 (Phase 2)
- `/admin/cs-targets` UI (Phase 2)
- BRIS 수집 자동화
- 로컬 v2 (localStorage) 저장 계층 이관

### Phase 1-b 판단 기준
- cs_dashboard 비가용 상황(네트워크·권한·버그)이 실제로 발생하면 구현
- 발생 전까지는 stub — CSV 파일을 받아서 파싱·매핑 흐름만 프로토타입

---

## 9. 리스크·Open Questions

| # | 항목 | 대응 |
|---|---|---|
| R1 | cs_dashboard.html 이 anon 키로 `cs_survey_targets` 에 확장 컬럼 write. RLS policy가 신규 컬럼을 막으면 writeback 실패 | 마이그레이션 후 anon 권한 테스트 · 필요 시 GRANT 보충 |
| R2 | bridge key 평문 노출 (단일 HTML) | 서버측 재검증이 1차 방어. Phase 2에서 Supabase auth 도입 |
| R3 | 동일 targetId 로 중복 호출 시 race | unique 제약 on (source_batch_id, target_id) 고려 또는 트랜잭션 처리 |
| R4 | survey_id 가 없는 batch 호출 | 400 명확 응답 + cs_dashboard에 survey_id 설정 UI 선행 추가 |
| R5 | 대량 호출 (1 batch 500+) | targets cap 500, 서버 타임아웃은 Fluid 300s 여유 |
| Q1 | 배치가 survey_id를 공유하는 패턴이 일반적? 아니면 같은 배치라도 target별 다른 survey? | **기본은 batch 1-survey 1.** 필요 시 Phase 2에서 target.survey_id override 추가 |
| Q2 | 즉시 발송 필요? (09:00 cron 외) | Phase 1-c 로 immediate 옵션 |
| Q3 | dispatched 이후 대상자 제거/교체는? | Phase 1 out-of-scope. Phase 2에서 재발송 워크플로우 |
