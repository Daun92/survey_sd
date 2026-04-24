import { test, expect } from "@playwright/test";
import { hasAdminCreds, loginAsAdmin } from "./helpers/auth";

/**
 * /admin/distribute 배부 관리 스모크.
 *
 * 현재는 "페이지 진입 + 핵심 UI 존재" 수준만 검증한다. 시드 데이터에
 * 의존하는 차수 생성/발송 플로우는 후속 PR 에서 service-role seed 와
 * 함께 확장.
 *
 * ENV:
 *   SURVEY_CS_ID / SURVEY_CS_PW — 운영 CS 관리 계정 (legacy E2E_ADMIN_EMAIL/PASSWORD 도 인식)
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * 실행: npx playwright test e2e/admin-distribute.spec.ts --reporter=list
 */

test.describe("/admin/distribute — smoke", () => {
  test.beforeAll(() => {
    if (!hasAdminCreds()) {
      test.skip(true, "SURVEY_CS_ID/PW 미설정 — 스킵");
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("배부 관리 페이지 헤더와 설문 선택 카드가 렌더된다", async ({ page }) => {
    await page.goto("/admin/distribute");

    // 헤더
    await expect(page.getByRole("heading", { name: "배부 관리" })).toBeVisible();
    await expect(page.getByText("설문 배포 링크를 생성하고 관리하세요")).toBeVisible();

    // 설문 선택 섹션
    await expect(page.getByText("설문 선택").first()).toBeVisible();

    // 진행중 / 전체 탭
    await expect(page.getByRole("button", { name: /진행중/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /전체/ })).toBeVisible();
  });

  test("하단 '응답 확인하기' CTA 가 /admin/responses 로 링크돼 있다", async ({ page }) => {
    await page.goto("/admin/distribute");
    const cta = page.getByRole("link", { name: /응답 확인하기/ });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/admin/responses");
  });

  test("전체 탭 클릭 시 설문 목록이 보이거나 '설문이 없습니다' 문구 노출", async ({ page }) => {
    await page.goto("/admin/distribute");
    const allTab = page.getByRole("button", { name: /전체/ });
    await allTab.click();

    // 드롭다운 혹은 빈 상태 문구 중 하나는 존재
    const dropdown = page.locator('select').first();
    const empty = page.getByText(/설문이 없습니다/);

    const hasDropdown = await dropdown.count();
    const hasEmpty = await empty.count();
    expect(hasDropdown + hasEmpty).toBeGreaterThan(0);
  });
});
