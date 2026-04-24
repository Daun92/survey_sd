# E2E 관리자 계정

Playwright E2E (`e2e/*.spec.ts`) 가 `/admin/*` 페이지에 진입할 때 사용하는 Supabase Auth 계정.

## 현재 구성

- **용도**: 로컬 및 향후 CI 의 admin UI 스모크 테스트
- **계정**: 운영 CS 관리 계정 재활용 (`htry2528@gmail.com` 등 실제 admin 권한 보유 계정)
- **credential 위치**: `.env.local` (git ignore). 2026-04-22 이후 네이밍:
  - `SURVEY_CS_ID` — 관리자 이메일
  - `SURVEY_CS_PW` — 비밀번호
  - legacy `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` 도 `e2e/helpers/auth.ts` 의 fallback 으로 계속 인식

## 로그인 플로우

`e2e/helpers/auth.ts:loginAsAdmin(page)`:

1. `/login` 페이지 진입
2. 이메일·비밀번호 폼 채워 "로그인" 버튼 클릭 (`exact: true`)
3. `window.location.href = redirectTo ?? "/admin"` 하드 네비게이트를 `waitForURL(/^\/admin/)` 로 대기
4. 이후 테스트 본문에서 보호 경로 자유 사용

> 과거에는 Supabase Auth REST 로 토큰만 받아 쿠키·localStorage 에 수동 주입했지만, `@supabase/ssr` 0.9 의 쿠키 포맷(base64- 접두사 + 청크 분할) 과 맞지 않아 세션 복원이 실패했다. 지금은 **실제 폼 제출** 방식이라 포맷 드리프트에 영향 없다.

## 새 계정으로 전환하고 싶을 때

1. Supabase Dashboard → Authentication → Users → Add user (Auto confirm)
2. `user_roles` 테이블에 admin 부여:
   ```sql
   INSERT INTO user_roles (user_id, role, display_name)
   SELECT id, 'admin', '원하는 표시 이름'
   FROM auth.users
   WHERE email = '새계정@example.com'
   ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
   ```
3. `.env.local` 에 `SURVEY_CS_ID` / `SURVEY_CS_PW` 교체
4. `npx playwright test e2e/admin-distribute.spec.ts --reporter=list` 로 smoke 재확인

## CI 연결 (후속)

현재 `.github/workflows/ci.yml` 은 E2E job 미포함. 필요 시 아래 방식으로 추가:

1. GitHub Settings → Secrets and variables → **Actions** 에 `SURVEY_CS_ID`, `SURVEY_CS_PW` 등록
2. ci.yml 에 `e2e` job 추가 (`npx playwright install chromium --with-deps` 포함)
3. baseURL 은 Vercel 프리뷰 URL 을 동적으로 주입 권장 (`${{ steps.deploy.outputs.url }}` 등)

## 주의

- **비밀번호는 절대 git tracked 파일에 커밋 금지.** `.env.local` 은 `.gitignore` 로 제외됨 — 유지.
- 정기 로테이션 시 `SURVEY_CS_PW` 갱신 + 이 문서 업데이트 날짜만 바꾸면 됨 (비밀번호 자체는 기록하지 않음).
- CI 에 도입할 경우 전용 E2E 계정으로 전환 권장 (감사 로그 분리).
