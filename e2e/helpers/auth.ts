import type { Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import path from "node:path";

loadDotenv({ path: path.resolve(process.cwd(), ".env.local"), override: false });

const clean = (v: string) => v.replace(/[\r\n\s]+$/g, "").trim();

const SUPA_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const SUPA_ANON = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
// 운영 네이밍 우선 (SURVEY_CS_*), legacy E2E_ADMIN_* 은 fallback
const ADMIN_EMAIL = clean(
  process.env.SURVEY_CS_ID ?? process.env.E2E_ADMIN_EMAIL ?? "",
);
const ADMIN_PASSWORD = clean(
  process.env.SURVEY_CS_PW ?? process.env.E2E_ADMIN_PASSWORD ?? "",
);

export function hasAdminCreds(): boolean {
  return Boolean(SUPA_URL && SUPA_ANON && ADMIN_EMAIL && ADMIN_PASSWORD);
}

/**
 * /login 페이지에서 이메일·비밀번호 폼을 직접 제출해 로그인한다.
 * supabase-js 클라이언트가 onAuthStateChange 를 돌려 @supabase/ssr 이
 * 기대하는 정확한 쿠키 포맷(base64-/청크 분할 등)으로 세션을 저장하므로,
 * 외부에서 토큰을 수동 주입하는 방식보다 견고하다.
 *
 * ENV 요구:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SURVEY_CS_ID / SURVEY_CS_PW  (운영 CS 관리 계정; 기존 E2E_ADMIN_EMAIL/PASSWORD 도 fallback 으로 인식)
 *
 * hasAdminCreds() 가 false 면 호출 전 test.skip() 권장.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  if (!hasAdminCreds()) {
    throw new Error("E2E admin credentials missing; call hasAdminCreds() first");
  }

  await page.goto("/login");
  await page.getByLabel("이메일").fill(ADMIN_EMAIL);
  await page.getByLabel("비밀번호").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  // signInWithPassword 성공 후 login-form 이 window.location.href = redirectTo ?? "/admin"
  // 으로 하드 네비게이트. /admin 프록시(proxy.ts) 를 지나 실제 페이지 로드까지 대기.
  await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 15000 });
}
