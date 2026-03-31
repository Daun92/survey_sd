# 설문 빠른 생성(Quick-Create) 500 에러 수정 작업 보고서

**작업일**: 2026-03-30
**저장소**: https://github.com/Daun92/survey_sd
**대상 배포**: https://exc-survey.vercel.app

---

## 1. 작업 배경

### 1.1 저장소 동기화
- 기존 로컬 origin(`cs-survey-app`)을 `survey_sd` 저장소로 변경
- `main` 브랜치로 동기화 완료
- 로컬 브랜치명 `master` → `main` 변경

### 1.2 발견된 문제
설문 빠른 생성(`/admin/quick-create`) 페이지에서 설문 생성 시 **연쇄적 500 에러** 발생.
브라우저 콘솔에 `POST /admin/quick-create 500 (Internal Server Error)` 반복 출력.

---

## 2. 근본 원인 분석

### 2.1 DB 스키마 이중 구조
프로젝트 DB에 두 가지 스키마 시스템이 공존:

| 구분 | 생성 방식 | 주요 테이블 | ID 타입 |
|------|----------|------------|---------|
| Prisma 기반 | `prisma migrate` | customers, service_types, surveys, distributions | INTEGER (auto-increment) |
| Supabase 기반 | `supabase/migrations/` | edu_surveys, edu_questions, projects, courses, sessions | UUID |

quick-create 서버 액션이 **양쪽 테이블을 모두 사용**하면서 스키마 불일치 문제 발생.

### 2.2 구체적 문제점 4가지

| # | 문제 | 원인 | 영향 |
|---|------|------|------|
| 1 | Next.js 프로덕션에서 에러 메시지 미전달 | 서버 액션에서 `throw new Error()` 사용 → 프로덕션에서 에러 메시지가 클라이언트에 전달되지 않음 | 사용자에게 500만 표시, 디버깅 불가 |
| 2 | `customers.service_type_id` NOT NULL 누락 | 고객 INSERT 시 필수 컬럼 `service_type_id` 미포함 | `null value in column "service_type_id"` 에러 |
| 3 | `service_types` 테이블 PostgREST 미노출 | Prisma로 생성된 테이블에 PostgREST 접근 권한(GRANT) 누락 | `PGRST205: Could not find the table` 에러 |
| 4 | `service_types` 시드 데이터 미삽입 | Prisma seed가 프로덕션 DB에 실행되지 않음 | FK 제약조건 위반 |

---

## 3. 수정 내역

### 3.1 커밋 이력

| 커밋 | 설명 |
|------|------|
| `6614b42` | 서버 액션 에러 처리 전면 개편 |
| `30386ac` | customers 테이블 service_type_id 컬럼 대응 |
| `e6d840a` | service_types 유연 매핑 + 디버그 로깅 추가 |
| `60cffee` | service_types 직접 ID 매핑 (테이블 미존재 확인 후) |
| `94c08f8` | DB 마이그레이션: service_types GRANT + seed 데이터 |

### 3.2 코드 변경 상세

#### (1) 서버 액션 에러 처리 개편 (`actions.ts`)

**변경 전:**
```typescript
// throw로 에러 발생 → 프로덕션에서 500만 반환, 메시지 미전달
export async function quickCreateSurvey(formData): Promise<QuickCreateResult> {
  // ...
  if (error) throw new Error("설문 생성 실패: " + error.message);
  return result;
}
```

**변경 후:**
```typescript
// 에러 응답 객체로 반환 → 클라이언트에서 구체적 메시지 표시
export type QuickCreateResponse =
  | { success: true; data: QuickCreateResult }
  | { success: false; error: string };

export async function quickCreateSurvey(formData): Promise<QuickCreateResponse> {
  try {
    // ...
    if (error) return { success: false, error: "설문 생성 실패: " + error.message };
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

#### (2) 인증/권한 체크 순서 수정

**변경 전:** `requireAuth()`가 DB 작업 4단계 이후(159번째 줄)에 호출됨

**변경 후:**
```typescript
export async function quickCreateSurvey(formData) {
  // 1. 인증 확인 (가장 먼저)
  const user = await requireAuth();

  // 2. 역할 확인 (RLS에서 creator 이상 필요)
  const { data: roleData } = await supabase
    .rpc("get_user_role", { p_user_id: user.id });
  if (roleData?.role === "viewer") {
    return { success: false, error: "설문 생성 권한이 없습니다." };
  }

  // 3. 이후 DB 작업 수행
}
```

#### (3) service_type_id 매핑

```typescript
// 과정구분 → service_type_id 직접 매핑
// (Prisma seed 기준: 1:집체, 2:원격교육, 3:HRM, 4:스마트훈련, 5:HR컨설팅)
const divisionToServiceTypeId: Record<string, number> = {
  classroom: 1,
  remote: 2,
  hrm: 3,
  content_dev: 4,
  smart: 4,
  hr_consulting: 5,
};
const serviceTypeId = divisionToServiceTypeId[input.educationType] ?? 1;
```

#### (4) 고객 생성 시 service_type_id 포함 + 복합키 조회

```typescript
// company_name + service_type_id가 UNIQUE 복합키
const { data: existingCustomer } = await supabase
  .from("customers")
  .select("id")
  .eq("company_name", input.customerName)
  .eq("service_type_id", serviceTypeId)
  .single();

// 신규 고객 생성
const { data: newCustomer } = await supabase
  .from("customers")
  .insert({
    company_name: input.customerName,
    service_type_id: serviceTypeId,  // NOT NULL 필수 컬럼
  })
  .select("id")
  .single();
```

### 3.3 DB 마이그레이션 (`021_fix_service_types_access.sql`)

Supabase SQL Editor에서 수동 실행:

```sql
-- PostgREST 접근 권한 부여
GRANT ALL ON public.service_types TO anon, authenticated, service_role;

-- 시드 데이터 삽입
INSERT INTO public.service_types (id, name, name_en, is_active, created_at)
VALUES (1, '집체', 'in_person', true, NOW()) ON CONFLICT (id) DO NOTHING;
-- ... (5개 서비스 유형)

-- PostgREST 스키마 캐시 리로드
NOTIFY pgrst, 'reload schema';
```

---

## 4. 부수 작업

### 4.1 Git 브랜치 정리
- 머지 완료된 원격 브랜치 19개 삭제
- 열린 PR 2개 (#5, #34) 이미 main 포함 확인 후 Close
- GitHub 기본 브랜치가 `claude/review-dev-status-JT6BA`로 설정되어 있음 → **`main`으로 변경 필요** (GitHub Settings > General > Default branch)

### 4.2 빌드 캐시 정리
- `.next/dev/types`에 삭제된 `/respond` 라우트 캐시 잔존 → `.next` 삭제 후 클린 빌드로 해결

---

## 5. 설문 생성 플로우 (수정 후)

```
사용자 → [간편 생성 폼]
  │
  ├─ 1. requireAuth()          ← 인증 확인
  ├─ 2. get_user_role RPC      ← creator 이상 역할 확인
  ├─ 3. service_type_id 매핑   ← 과정구분 → 정수 ID
  │
  ├─ 4a. 기존 프로젝트 선택    ← projects + customers 조회
  │   or
  ├─ 4b. 새 프로젝트 생성
  │   ├─ customers 조회/생성   ← company_name + service_type_id
  │   └─ projects INSERT
  │
  ├─ 5. courses INSERT
  ├─ 6. sessions INSERT
  ├─ 7. edu_surveys INSERT     ← owner_id = user.id
  ├─ 8. edu_questions INSERT   ← 템플릿 문항 복사
  └─ 9. skip_logic 설정        ← 에코시스템 문항 자동 설정
```

---

## 6. 향후 참고사항

- **Prisma 테이블 추가 시**: PostgREST GRANT 수동 실행 필요
- **service_types 변경 시**: `actions.ts`의 `divisionToServiceTypeId` 매핑도 함께 수정
- **에러 디버깅**: Vercel 런타임 로그에서 `[quick-create]` 태그로 필터링
