<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 배포 환경

- **Vercel 프로젝트**: `exc-survey` (팀: `daun92's projects`, id `prj_PgjIppaIsTazIkQxrA63EIlbfBjm`)
- **배포 URL**: https://exc-survey.vercel.app
- **Supabase 프로젝트**: `cs-survey` (ref `gdwhbacuzhynvegkfoga`, region ap-northeast-2)
- **GitHub**: https://github.com/Daun92/survey_sd — main 브랜치가 Vercel 프로덕션 트리거
- **Cron**: 매일 9시(UTC) `/api/cron/send-emails`, `/api/cron/send-sms`

## 로컬 개발 환경 세팅

### 첫 실행 (worktree 마다 반복)

```bash
# 1) Vercel 프로젝트 링크 (daun92 계정 필요)
vercel link --yes --project exc-survey

# 2) 환경변수 내려받기 (preview 환경 + 개발용 CRON_SECRET 수동 보강)
vercel env pull .env.local --environment=preview --yes
vercel env pull .env.development.tmp --environment=development --yes
grep "^CRON_SECRET=" .env.development.tmp >> .env.local
echo 'NEXT_PUBLIC_APP_URL="http://localhost:3000"' >> .env.local
rm .env.development.tmp

# 3) 의존성 설치 + Prisma 클라이언트 생성
npm install
npx prisma generate

# 4) dev 서버
npm run dev   # http://localhost:3000
```

**주의**: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_APP_URL`는 Vercel Development 환경에는 없고 Preview/Production에만 있어서 `--environment=preview`로 pull 해야 한다. `CRON_SECRET`은 반대로 Development에만 있으니 별도로 합친다.

### Prisma introspect 할 때 (필요할 때만)

기본 `DATABASE_URL`은 Supabase Pooler (port 6543). Prisma introspect는 Transaction Pooler에서 timeout 나므로 Session Pooler(port 5432)로 바꿔서 실행:

```bash
DB_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | sed 's/^DATABASE_URL=//;s/^"//;s/"$//')
SESSION_URL=$(echo "$DB_URL" | sed 's|:6543/|:5432/|')
DATABASE_URL="$SESSION_URL" npx prisma db pull
```

추가로 `auth.users` 크로스 스키마 FK 때문에 `datasource db { schemas = ["public","auth"] }` 필요.

## 스키마 관리 원칙

이 저장소는 **두 가지 마이그레이션 시스템**이 공존한다. 역할을 섞지 말 것:

| 시스템 | 역할 | 커버 범위 |
|--------|------|-----------|
| `supabase/migrations/NNN_*.sql` | **운영 스키마 source of truth** | 전체 57개 public 테이블 |
| `prisma/schema.prisma` | **타입세이프 쿼리용 래퍼** | 핵심 12 모델 (Customer, Survey, Distribution, Response, ResponseAnswer, ServiceType, QuestionTemplate, TrainingRecord, Interview, MonthlyReport, ImportLog, SurveyQuestion) |

### 새 테이블/컬럼 추가 절차

1. `supabase/migrations/NNN_이름.sql` 작성 → Supabase Dashboard SQL Editor 또는 `mcp__supabase__apply_migration`으로 운영 DB에 적용
2. 이미 Prisma가 커버하는 12개 테이블에 컬럼을 추가했다면 `prisma/schema.prisma`를 **수동**으로 맞추고 `npx prisma generate`
3. 새로 만든 테이블은 **Prisma 모델을 추가하지 말고** Supabase client로 접근한다 (아래 참조)

`prisma migrate dev/deploy`는 **사용하지 않는다**. 마이그레이션 기록이 supabase 시스템과 어긋나면 복구 비용이 크다.

### Prisma가 커버하지 않는 테이블 접근

다음 유틸리티 사용:

- **서버 컴포넌트 / API Route (RLS 우회 필요)**: `import { createAdminClient } from "@/lib/supabase/admin"` — service role
- **서버 컴포넌트 / API Route (사용자 컨텍스트)**: `import { createClient } from "@/lib/supabase/server"` — cookie 기반 세션
- **클라이언트 컴포넌트**: `import { createClient } from "@/lib/supabase/client"`

주요 Non-Prisma 테이블: `user_profiles`, `organizations`, `cs_companies`, `cs_business_places`, `cs_contacts`, `cs_projects`, `cs_courses`, `cs_survey_targets`, `cs_survey_questions`, `cs_dispatch_records`, `edu_surveys`, `edu_questions`, `edu_submissions`, `email_queue`, `sms_queue`, `email_providers`, `sms_providers`, `hrd_*`, `app_settings` 등.

## 검증 체크리스트

`npm run dev` 실행 후 확인:
- `/` → `/login?redirect=%2Fadmin` 307 리다이렉트 (global middleware 동작)
- `/login` 200 + "EXC-Survey" 로그인 화면
- 브라우저 콘솔에 Supabase 초기화 에러 없음
- 관리자 로그인 → `/admin/*` 페이지 진입 성공

