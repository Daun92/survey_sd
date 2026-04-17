# 2026-04-17 · Phase 1 실행 (Step A · B 완료 · C 착수)

**Goal**: runbook Step A~C 실제 실행. 설계는 모두 완료(이전 세션 파일), 이제 착수.

## Done

### Step A — 브랜치·환경 준비
- 브랜치 `feature/cs-bridge-phase1` 생성 (main 기반)
- Vercel 프로젝트 링크 (`.vercel/` 생성, 프로젝트: `daun92s-projects/exc-survey`)
- `vercel env pull` 로 `.env.local` 구성 (preview + CRON_SECRET + APP_URL)
- `CS_BRIDGE_API_KEY` 로컬용 64-hex 생성 + append
- `npx prisma generate` 실행 (src/generated/prisma 재생성)
- TypeScript 컴파일 src/ 에러 0 확인
- `.env*.local` 자동 gitignore 추가됨 (vercel CLI가 반영)

### Step B — DB 마이그레이션 (028)

**1차 시도 에러**:
```
foreign key constraint "cs_target_batches_survey_id_fkey" cannot be implemented
DETAIL: Key columns "survey_id" and "id" are of incompatible types: uuid and integer.
```

**원인 조사 결과 (→ ADR-008)**:
- `public.surveys` (id integer, 0 rows) = Prisma legacy 모델, 실사용 안 됨
- `public.edu_surveys` (id uuid, 9 rows) = 실운영 설문 테이블
- `public.distributions` (uuid) · `public.distribution_batches` (uuid) 의 `survey_id` FK 는 `edu_surveys` 참조
- `src/app/admin/distribute/actions.ts` 등 20+ 파일이 Supabase client (`from('edu_surveys')`) 사용
- Prisma `Distribution` 모델(int ID)의 `distribution.repository.ts` 는 legacy 코드

**수정 후 재적용**:
- FK 타겟을 `edu_surveys(id)` 로 변경 → 성공
- 적용된 스키마 변경:
  - `cs_survey_targets` : +6 컬럼 (distribution_id, survey_token, survey_url, dispatched_at, dispatch_channel, dispatch_error) + 2 인덱스
  - `distribution_batches` : +2 컬럼 (source, source_batch_id) + 1 인덱스
  - `cs_target_batches` : +1 컬럼 (survey_id, FK → edu_surveys)
- 기존 레코드 영향 확인:
  - distribution_batches 5건 모두 `source='manual'` (default 적용)
  - cs_target_batches 5건 survey_id NULL (예상대로)
  - cs_survey_targets 80건 distribution_id NULL (예상대로)

### 문서 갱신
- `decisions.md` +ADR-008 (edu_surveys 발견 · Supabase client 단일화)
- `phase1-spec.md`, `phase1-runbook.md` : `surveys` → `edu_surveys` 교체
- `phase1-runbook.md` C-2 : Prisma 의존성 제거, Supabase client 단일화로 스켈레톤 수정

### 커밋
- `9a0b578 feat(cs-integration): Phase 1 Step B — docs + migration 028`
  - docs/cs-integration/ 전체 신규 (README·context·decisions·phase1/2·worklog)
  - supabase/migrations/028_cs_bridge_phase1.sql
  - .gitignore (.env*.local)

## Decisions (append 결정)
- **ADR-008**: 실운영 설문 = `edu_surveys`. Bridge API도 Supabase client 단일화 (Prisma 사용 제거, ADR-007 강화)

## Next
- **Step C**: Bridge API 구현 (`src/app/api/distributions/cs-bridge/route.ts`)
  - Supabase client 기반 (service_role)
  - Zod payload 검증
  - cs_survey_targets 재검증 → distributions insert → writeback 결과 응답
  - smoke test (curl)

## Open Items (실행 중 발견)
- R1 (RLS 신규 컬럼 anon write 허용) → Step E preview 테스트에서 확인
- D1 (cs_dashboard.html survey_id 지정 UI 부재) → 초기 테스트는 SQL 수동 UPDATE
- D2 (Prisma DistributionBatch.source 반영 여부) → **해소**: Supabase client 단일화로 불필요
- D3 (unique 제약) → Step C 구현 후 판단. 일단은 서버측 `distribution_id IS NULL` 체크로 방어
