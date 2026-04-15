# Prisma 스키마 전체 동기화 작업 계획서 (B안)

**작성일**: 2026-04-15
**목적**: `prisma/schema.prisma`를 운영 DB 전체 57개 `public` 테이블 + 필요한 `auth` 테이블로 확장하되, 기존 12개 PascalCase 모델과 현재 27개 소스 파일(81곳 호출부)은 한 줄도 깨지지 않도록 한다.

---

## 0. 배경 (왜 이게 필요한가)

### 현재 상태 (2026-04-15 기준)

`prisma/schema.prisma` — 12개 PascalCase 모델만 정의 (265 줄):
- ServiceType, Customer, Survey, SurveyQuestion, QuestionTemplate, TrainingRecord, Distribution, Response, ResponseAnswer, Interview, MonthlyReport, ImportLog
- 각 필드는 camelCase + `@map("snake_case")` 관례

운영 DB `gdwhbacuzhynvegkfoga` — 전체 57개 public 테이블:
- 위 12개 + 추가 45개: `user_roles`, `organizations`, `projects`, `courses`, `sessions`, `class_groups`, `instructors`, `session_instructors`, `respondents`, `edu_surveys`, `edu_questions`, `edu_submissions`, `edu_survey_templates`, `hrd_*` (8개), `cs_*` (17개), `email_queue`, `email_templates`, `sms_queue`, `sms_templates`, `sms_providers`, `distribution_batches`, `app_settings`, `bris_*` (3개), `public_sessions`, `question_templates`, `survey_questions`, `surveys`, `import_logs` 등

**결과**: 새로 추가된 테이블은 Prisma 타입 커버리지 없음. 개발자는 Supabase client로 우회 중 (어떤 건 RLS service role, 어떤 건 anon/user context). 타입 안전성과 IDE 자동완성 혜택이 절반만 적용됨.

### A안을 왜 선택했나 (지난 세션 기록)

이전 세션에서 `prisma db pull` 실행 → 80개 모델 생성됨. 하지만 introspect는:
1. 모델명을 snake_case로 바꿈 (`customers`, `surveys`)
2. 필드명도 snake_case로 바꿈 (`company_name`, `service_type_id`)

결과적으로 기존 코드의 `prisma.customer.findMany()`, `customer.companyName` 등 **27 파일 / 81곳**이 compile error. 당시엔 시간 제약으로 A안(원복) 선택.

---

## 1. 목표 (Definition of Done)

- [ ] `prisma/schema.prisma`에 기존 12개 PascalCase 모델이 **이름/필드명 그대로** 남아있다 (`prisma.customer` 호출 그대로 동작)
- [ ] `prisma/schema.prisma`에 새로 **45개+ 모델**이 추가되어 있다 (네이밍은 snake_case 허용 — 신규 모델만)
- [ ] `auth.users`는 cross-schema relation이 깨지지 않도록 포함
- [ ] `npx prisma validate` 통과
- [ ] `npx prisma generate` 통과
- [ ] `npm run build` 통과 (TypeScript error 0)
- [ ] `npm run dev` 실행 후 `/`, `/login`, `/admin/*` 주요 페이지 200 OK
- [ ] 기존 테스트 (`npm test` or `e2e/`) 깨지지 않음 — 있다면
- [ ] 변경 내용과 rationale이 commit message에 명시됨

---

## 2. 작업 절차 (상세)

### Step 1 — 현재 상태 스냅샷

```bash
cp prisma/schema.prisma prisma/schema.prisma.current
git log --oneline -1   # 시작 커밋 기록
```

### Step 2 — Session Pooler로 전체 introspect

현 DATABASE_URL은 Transaction Pooler(6543). Introspect는 Session Pooler(5432)에서만 동작.

```bash
# 임시로 schemas 설정 추가 (이미 이전 세션에서 시도했던 상태)
# datasource db { provider = "postgresql"; schemas = ["public", "auth"] }

# 단, 기존 schema는 그대로 유지해야 하므로 별도 파일로 introspect
DB_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | sed 's/^DATABASE_URL=//;s/^"//;s/"$//')
SESSION_URL=$(echo "$DB_URL" | sed 's|:6543/|:5432/|')

# 빈 schema 파일로 full pull
cat > /tmp/prisma-pull-schema.prisma <<'EOF'
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["public", "auth"]
}
EOF

DATABASE_URL="$SESSION_URL" npx prisma db pull --schema /tmp/prisma-pull-schema.prisma --force

# 결과: /tmp/prisma-pull-schema.prisma 에 80개 모델 전체가 생성됨
```

### Step 3 — diff 분석

```bash
# 기존 schema의 12 모델 vs introspect 80 모델 비교
grep "^model " prisma/schema.prisma | awk '{print $2}' | sort > /tmp/existing.txt
grep "^model " /tmp/prisma-pull-schema.prisma | awk '{print $2}' | sort > /tmp/all.txt

# 교집합 (기존에 있던 것)
comm -12 /tmp/existing.txt /tmp/all.txt   # 예상: 공집합 (기존은 PascalCase, pull은 snake)

# introspect만 있는 것 (추가해야 할 후보)
comm -13 /tmp/existing.txt /tmp/all.txt

# 기존 12개에 해당하는 snake_case 이름 목록:
#   customers, surveys, survey_questions, question_templates, training_records,
#   distributions, responses, response_answers, interviews, monthly_reports,
#   import_logs, service_types
```

### Step 4 — 신규 모델만 추출

`/tmp/prisma-pull-schema.prisma`에서 **12개 snake_case 중복 모델과 그들만의 @@schema/relation**은 **버리고**, 나머지 68개 (= 80 - 12) 모델만 추출.

주의할 것:
- `auth.*` 모델들은 그대로 가져오되, 앱 코드에서 직접 쓰지 않으므로 `@@schema("auth")`만 유지
- `users` 모델(auth.users)은 반드시 포함 — 여러 public 테이블이 FK 걸고 있음

### Step 5 — 신규 모델의 relation을 기존 PascalCase로 재연결

68개 신규 모델 중 기존 12 모델의 테이블을 FK 참조하는 것들의 relation 타입을 바꿔줘야 한다.

예시 (introspect 원본):
```prisma
model response_answers {
  ...
  responses        responses        @relation(fields: [response_id], references: [id], onDelete: Cascade)
  survey_questions survey_questions @relation(fields: [question_id], references: [id])
}
```

이건 우리가 버릴 snake_case 모델이라 예시로 적합하지 않음. 실제 대상은 neoteric 모델이 구 모델 참조하는 경우:

```prisma
# 예: edu_surveys가 auth.users를 참조 (이건 유지)
model edu_surveys {
  owner_id String? @db.Uuid
  users    users?  @relation(fields: [owner_id], references: [id])   # auth.users
  ...
}

# 예: cs_courses가 customers를 참조?
# 실제로 참조하는지 확인 필요 — supabase/migrations/ 004, 005, 006번 파일 참조
```

**체크 작업**:
- grep으로 FK를 잡아낸다: `grep -E "references: \[.*\]" /tmp/prisma-pull-schema.prisma`
- 기존 12 모델 테이블명으로 FK 걸린 게 있으면 해당 relation의 TYPE을 PascalCase로 교체
  - `customers customers` → `customer Customer` (필드명도 camelCase 관례)
  - 반대편: `Customer` 모델에 `response Response[]` 같은 back-ref도 맞춰줄 필요가 있을 수 있음

### Step 6 — 최종 schema 조립

```
prisma/schema.prisma (목표 구조):
  1. generator + datasource (schemas = ["public", "auth"] 추가)
  2. 기존 12개 PascalCase 모델 (수정 없음)
  3. 신규 ~45개 public snake_case 모델 (@@schema("public") 붙이거나, 단일 schema 원복 시 생략)
  4. auth.* 필요한 모델들 (최소 users + 관련 보조 테이블)
```

### Step 7 — 검증

```bash
npx prisma validate        # 문법/참조 오류 확인
npx prisma format          # 포맷 정렬
npx prisma generate        # 타입 재생성
npx tsc --noEmit           # TS 컴파일 에러 확인 (빠른 검증)
npm run build              # 최종 확인
npm run dev
# /admin/customers → Customer.findMany 동작 확인
# /admin/hrd → 신규 모델 쿼리 가능성 확인
```

### Step 8 — 롤백 플랜

실패 시:
```bash
cp prisma/schema.prisma.current prisma/schema.prisma
npx prisma generate
```

---

## 3. 예상 난관

1. **cross-schema relation 순서**: `auth.users`를 먼저 정의하지 않으면 `public.edu_surveys.owner_id` FK가 에러. `@@schema` 어노테이션으로 해결.
2. **FK 필드명 충돌**: introspect가 만든 `users users @relation(...)` 같은 필드명은 PascalCase 모델과 섞이면 어색. 필드명을 `owner`, `createdBy` 등으로 수동 리네임 필요.
3. **RLS 주석**: introspect는 `/// This model contains row level security ...` 주석을 자동 추가. 유지하면 마이그레이션 경고 해소 힌트가 됨. 삭제해도 무방.
4. **중복 모델 감지**: 혹시 Prisma가 "두 모델이 같은 테이블을 가리킨다"고 에러 내면 `@@map` 겹침. `schema.prisma` 안에 같은 테이블을 가리키는 모델은 1개만 있어야 함.
5. **expression index 미지원**: `sso_domains_domain_idx` 같은 건 Prisma가 무시. 경고는 무해.

---

## 4. 참고 파일 / 경로

- 현재 schema: [prisma/schema.prisma](../prisma/schema.prisma)
- 운영 SQL 마이그레이션: `supabase/migrations/001~027_*.sql` (57 테이블의 진실원)
- Prisma client import: [src/lib/db.ts](../src/lib/db.ts)
- Supabase client 폴더: [src/lib/supabase/](../src/lib/supabase/)
- 12 모델을 쓰는 호출부(약 27 파일): `grep -rln "prisma\\.\\(customer\\|survey\\|distribution\\|response\\|interview\\|serviceType\\|questionTemplate\\|trainingRecord\\|importLog\\|monthlyReport\\|surveyQuestion\\|responseAnswer\\)" src --include="*.ts" --include="*.tsx"`
- 환경 세팅 가이드: [AGENTS.md](../AGENTS.md) "로컬 개발 환경 세팅" / "Prisma introspect 할 때" 섹션

---

## 5. 예상 소요

실질 작업 45~60분 + 검증 20분. 한 세션에 끝낼 수 있음.
