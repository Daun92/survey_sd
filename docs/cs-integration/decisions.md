# Decision Log

> **Append-only.** 새 결정은 맨 아래에. 이전 항목은 수정하지 않고, 변경이 필요하면 새 ADR로 supersede 표시.

포맷:
```
## ADR-NNN · YYYY-MM-DD · <제목>
**Status**: Accepted / Superseded by ADR-NNN / Rejected
**Context**: 왜 결정이 필요했나
**Decision**: 무엇을 정했나
**Consequences**: 이로 인한 효과·트레이드오프
```

---

## ADR-001 · 2026-04-17 · 통합 스코프를 Phase 1 + Phase 2 로 확정
**Status**: Accepted
**Context**: 로컬 v2 (localStorage) · Supabase `cs_*` (미연결) · survey_sd 앱 세 시스템이 단절. 전체 통합 규모가 커서 단계 구분 필요.
**Decision**:
- **Phase 1**: 축소 CSV Import 최소 브릿지 (양쪽 기존 워크플로우 보존)
- **Phase 2**: DB `cs_*` 파이프라인 활성화 + 로컬 v2 저장 계층을 Supabase로 이관
- **Phase 3** (BRIS 수집 서버 이관·로컬 툴 폐기)은 본 스코프 밖
**Consequences**:
- Phase 1로 매월 운영 단절점 즉시 해소
- Phase 2로 중앙화된 대상자 관리 확보, 로컬 툴은 당분간 병행
- Phase 3는 사내망 제약 해소 방안이 생길 때 재검토

## ADR-002 · 2026-04-17 · 로컬 v2 HTML 툴은 당분간 유지
**Status**: Accepted
**Context**: 사용자 의사 = "장기적으로 앱에 흡수하고 싶음, 지금 당장 폐기 아님". BRIS 수집이 사내망에서만 가능해 전면 이관 어려움.
**Decision**: Phase 2에서도 로컬 v2가 Supabase를 직접 쓰도록 어댑터를 추가하되, UI는 그대로 둠. 폐기는 Phase 3 범위.
**Consequences**:
- Phase 2 구현 시 로컬 v2 JS의 저장 계층만 바꾸면 되어 변화 최소
- 당분간 localStorage ↔ Supabase 양방향 동기 또는 한쪽 master 선택 필요 → Phase 2 spec에서 결정

## ADR-003 · 2026-04-17 · `cs_*` 기존 데이터는 현 운영 도구와 공존 필요
**Status**: Superseded by ADR-005
**Context**: Supabase `cs_*` 테이블에 이미 80건 target / 5 batch / 81 contacts 등이 들어 있음. 사용자에 따르면 "수기 대시보드 다른 도구"가 현재 사용 중.
**Decision**: Phase 1에서는 `cs_*` 테이블을 건드리지 않음. Phase 2 착수 전 "다른 도구"의 read/write 경로를 조사하여 충돌 없도록 설계.
**Consequences**:
- Phase 1 범위 단순화 (distribution_batches/distributions만 신규 쓰기)
- Phase 2 킥오프 조건 = "다른 도구" 조사 완료 + 공존 전략 결정

## ADR-004 · 2026-04-17 · 통합 문서 위치는 survey_sd/docs/cs-integration/
**Status**: Accepted
**Context**: 실제 코드 변경은 survey_sd에서 발생. worklog·context·결정을 코드와 같은 레포에 두어 PR·diff와 함께 추적 가능.
**Decision**: 모든 통합 관련 문서는 `survey_sd/docs/cs-integration/` 하위. 로컬 v2 (`02. 대상자관리`) 내부 문서는 그대로 유지, 이 디렉토리에서 참조만 함.
**Consequences**:
- 세션 간 일관성 유지 (git log로 변경 추적)
- 로컬 v2 단독 문서와 통합 문서가 물리적으로 분리되어 역할 명확

## ADR-005 · 2026-04-17 · "다른 도구" = `cs_dashboard.html`, 미구현 cs-bridge 계약 발견
**Status**: Accepted (supersedes ADR-003)
**Context**: `02. 대상자관리/참고/cs_dashboard.html` 조사 결과, 이것이 현재 운영 중인 "다른 도구". Supabase anon 키로 `cs_*` 테이블 직접 CRUD. 이 도구의 `dispatchSurvey()` 가 이미 `https://exc-survey.vercel.app/api/distributions/cs-bridge` 호출하도록 작성돼 있으나 survey_sd에 엔드포인트 없음 → 현재 수기 CSV 운영의 직접 원인.
**Decision**:
- cs_dashboard.html 은 Phase 2까지 주요 운영 도구로 유지 (폐기 X)
- Phase 2에서 기능을 survey_sd로 점진 흡수, cs_dashboard는 백업/감사용으로 남김
- cs-bridge 계약(URL, 헤더, payload, writeback 필드)은 cs_dashboard.html의 기대값을 존중하여 구현 — 클라이언트 수정 최소화
**Consequences**:
- Phase 1 범위가 "CSV import"에서 **"cs-bridge API 구현"** 으로 재정의 (더 작음)
- 양 도구의 anon/authenticated 접근 충돌 방지 위한 RLS 정리 Phase 2 범위
- ADR-003 스코프("cs_* 건드리지 않음")는 폐기 — Phase 1에서 `cs_survey_targets`에 컬럼 추가 필요

## ADR-008 · 2026-04-17 · 실운영 설문 테이블은 `edu_surveys` (uuid), Prisma `Survey`/`Distribution`은 legacy
**Status**: Accepted
**Context**: Step B 마이그레이션 적용 중 FK 타입 불일치 발생. 조사 결과:
- `public.surveys` (integer id, 0 rows) = Prisma legacy 모델 대응, 실사용 안 됨
- `public.edu_surveys` (uuid id, 9 rows) = 실운영 설문 테이블
- `public.distributions` (uuid) · `public.distribution_batches` (uuid) 의 `survey_id` FK 는 `edu_surveys` 참조
- `src/app/admin/distribute/actions.ts` 등 20+ 파일이 Supabase client (`from('edu_surveys')`) 로 작업 중
- Prisma `Distribution` 모델(int ID) 을 쓰는 `src/lib/repositories/distribution.repository.ts` 는 legacy 코드
**Decision**:
- `cs_target_batches.survey_id` FK 타겟 = `edu_surveys(id)` (uuid)
- Bridge API 및 Phase 1·2 전 구현 = Supabase client 기반 (ADR-007 일관성 강화)
- Prisma `Survey`·`Distribution`·`DistributionBatch` 모델 변경 안 함 (legacy 보존)
- Phase 1 spec/runbook 의 `surveys` → `edu_surveys` 로 교체 완료
**Consequences**:
- Bridge API 스켈레톤이 `prisma.distribution.create()` → `supa.from('distributions').insert()` 로 전환 필요
- distribution_batches/distributions 변경 시 Prisma generate 재실행 불필요
- 앱 전체의 "설문" 참조가 edu_surveys 기준이라는 것이 문서화됨

## ADR-007 · 2026-04-17 · `cs_*` 접근은 Supabase client 사용 (Prisma 모델 추가 않음)
**Status**: Accepted
**Context**: `claude/romantic-lederberg` 브랜치 점검 결과 = B안 계획서만 작성됨(2 commits, 코드 변경 없음). 동일 브랜치의 `AGENTS.md` 가이드는 **"새로 만든 테이블은 Prisma 모델을 추가하지 말고 Supabase client로 접근한다"** 를 명시하며 `cs_*` 전 테이블이 Non-Prisma 목록에 포함됨. `cs_dashboard.html` 도 동일하게 Supabase client를 쓰고 있어 접근 방식 통일 가능.
**Decision**:
- Phase 1·2 모두 `cs_*` 은 `@supabase/ssr` · `@supabase/supabase-js` 로 접근
- `src/lib/supabase/admin.ts` (service_role) / `src/lib/supabase/server.ts` (cookie 세션) / `src/lib/supabase/client.ts` (브라우저) 유틸 재사용
- `distributions`·`distribution_batches`·`surveys` 등 기존 Prisma 모델은 계속 Prisma 사용 (하이브리드)
- B안은 별개 일정. 완료되더라도 Phase 1·2 코드 그대로 유지, 추후 선택적 리팩토링
**Consequences**:
- Phase 2 스코프 축소 (Prisma 스키마 작업 불필요)
- 타입 안전성은 `supabase gen types typescript` 로 생성한 타입으로 확보 (기존 관례 따를 것)
- B안 선행 조건 해제 — Phase 1 완료 직후 Phase 2 착수 가능

## ADR-006 · 2026-04-17 · Phase 1 범위 = cs-bridge API 우선, CSV import 후순위
**Status**: Accepted
**Context**: cs_dashboard.html 발견으로 실제 운영 단절점이 "CSV 왕복"이 아니라 "미구현 bridge API" 임이 드러남.
**Decision**:
- Phase 1-a (우선): cs-bridge API + `cs_survey_targets` 확장 컬럼 마이그레이션 + `cs_target_batches↔surveys` 링크 + Vercel 환경변수
- Phase 1-b (보조): CSV Import UI — cs_dashboard를 못 쓸 때 수동 대체 경로 (필요 시만 구현)
- `distribution_batches` 에 `source`·`source_batch_id` 컬럼 추가 (두 진입점 공통)
**Consequences**:
- Phase 1 규모 축소 (1-3일 예상)
- cs_dashboard 수정 최소화 (`BRIDGE_KEY` placeholder 값만 교체)
- 아직 cs_dashboard.html이 보낸 payload와 실제 테이블 컬럼 사이 간극 해소 필요 (distribution_id, survey_token 등 신규 컬럼)
