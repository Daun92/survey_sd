import { test, expect } from "@playwright/test";
import { hasAdminCreds, loginAsAdmin } from "./helpers/auth";

/**
 * 설문 빌더 3-컬럼 스모크
 *
 * ENV:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — 관리자/작성자 권한 계정
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   E2E_BUILDER_SURVEY_ID (선택) — 특정 설문 id 고정. 없으면 목록 첫 카드 선택
 *
 * 실행: npx playwright test e2e/survey-builder.spec.ts --reporter=list
 */

const BUILDER_SURVEY_ID = process.env.E2E_BUILDER_SURVEY_ID ?? "";

test.describe("survey builder 3-column", () => {
  test.beforeAll(() => {
    if (!hasAdminCreds()) {
      test.skip(true, "E2E_ADMIN_EMAIL/PASSWORD 미설정 — 스킵");
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("3-컬럼 레이아웃이 렌더되고 저장 버튼이 보인다", async ({ page }) => {
    if (BUILDER_SURVEY_ID) {
      await page.goto(`/surveys/${BUILDER_SURVEY_ID}`);
    } else {
      await page.goto("/surveys");
      const firstCard = page.getByRole("link").filter({ hasText: /./ }).first();
      await firstCard.click();
    }

    // Topbar 의 저장 버튼
    await expect(page.getByRole("button", { name: /저장/ })).toBeVisible();

    // 아웃라인(좌), 미리보기 토글(상), 인스펙터 빈 상태 안내문 중 최소 하나
    await expect(page.getByText(/문항 목록|문항 편집/)).toBeVisible();
  });

  test("문항 추가 클릭 시 아웃라인 수가 증가한다", async ({ page }) => {
    if (BUILDER_SURVEY_ID) {
      await page.goto(`/surveys/${BUILDER_SURVEY_ID}`);
    } else {
      await page.goto("/surveys");
      await page.getByRole("link").filter({ hasText: /./ }).first().click();
    }

    // 현재 문항 수 캡처 (아웃라인 Q## 숫자 기반)
    const badges = page.locator("text=/^Q\\d{2}$/");
    const before = await badges.count();

    await page.getByRole("button", { name: /문항 추가/ }).click();

    await expect(badges).toHaveCount(before + 1);
  });

  test("미리보기 토글로 캔버스 상태 표시가 바뀐다", async ({ page }) => {
    if (BUILDER_SURVEY_ID) {
      await page.goto(`/surveys/${BUILDER_SURVEY_ID}`);
    } else {
      await page.goto("/surveys");
      await page.getByRole("link").filter({ hasText: /./ }).first().click();
    }

    const toggle = page.getByRole("switch", { name: /미리보기/ });
    await expect(toggle).toBeVisible();

    await expect(page.getByText("편집 모드")).toBeVisible();
    await toggle.click();
    await expect(page.getByText(/미리보기 모드/)).toBeVisible();
  });

  test("URL ?q= 가 선택 문항을 결정한다", async ({ page }) => {
    if (!BUILDER_SURVEY_ID) {
      test.skip(true, "E2E_BUILDER_SURVEY_ID 미설정 — 직접 URL 테스트 스킵");
    }

    await page.goto(`/surveys/${BUILDER_SURVEY_ID}`);
    // 첫 문항 id 를 아웃라인에서 찾기 위해 한 번 로드
    await expect(page.getByRole("button", { name: /저장/ })).toBeVisible();

    // 임의 문항 두 번째 row 를 클릭해 URL 변화 확인
    const rows = page.locator("aside").first().locator("[role='button'], .cursor-pointer");
    if ((await rows.count()) > 1) {
      await rows.nth(1).click();
      await expect(page).toHaveURL(/[?&]q=\d+/);
    }
  });
});
