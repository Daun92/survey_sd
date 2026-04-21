import type { Page, BrowserContext } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import path from "node:path";

loadDotenv({ path: path.resolve(process.cwd(), ".env.local"), override: false });

const clean = (v: string) => v.replace(/[\r\n\s]+$/g, "").trim();

const SUPA_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const SUPA_ANON = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
const ADMIN_EMAIL = clean(process.env.E2E_ADMIN_EMAIL ?? "");
const ADMIN_PASSWORD = clean(process.env.E2E_ADMIN_PASSWORD ?? "");

export function hasAdminCreds(): boolean {
  return Boolean(SUPA_URL && SUPA_ANON && ADMIN_EMAIL && ADMIN_PASSWORD);
}

/**
 * Supabase Auth REST 로 signInWithPassword → 세션 토큰을 Supabase Auth 쿠키로 주입.
 *
 * ENV 요구:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   E2E_ADMIN_EMAIL
 *   E2E_ADMIN_PASSWORD
 *
 * hasAdminCreds() 가 false 면 호출 전 test.skip() 권장.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  if (!hasAdminCreds()) {
    throw new Error("E2E admin credentials missing; call hasAdminCreds() first");
  }

  const res = await page.request.post(
    `${SUPA_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: SUPA_ANON,
        "Content-Type": "application/json",
      },
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    },
  );
  if (!res.ok()) {
    throw new Error(`Supabase login failed: ${res.status()} ${await res.text()}`);
  }
  const session = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Supabase JS SDK 가 기본적으로 사용하는 로컬 저장 키에 주입
  // (서버 쪽 createClient 가 쿠키·localStorage 양쪽에서 조회 가능하도록)
  const projectRef = new URL(SUPA_URL).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify([
    session.access_token,
    session.refresh_token,
    null,
    null,
    null,
  ]);

  const ctx: BrowserContext = page.context();
  await ctx.addCookies([
    {
      name: storageKey,
      value: encodeURIComponent(cookieValue),
      domain: new URL(page.url() === "about:blank" ? (process.env.E2E_BASE_URL ?? "http://localhost:3000") : page.url()).hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // 앱 측 middleware 가 localStorage 기반 SDK 토큰을 우선시하는 경우 대비
  await page.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    { key: storageKey, value: cookieValue },
  );
}
