import { test, expect } from "@playwright/test";
import { hasAdminCreds, loginAsAdmin } from "./helpers/auth";

/**
 * /admin/reports 5탭 스모크
 *
 * ENV:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   E2E_ADMIN_REPORT_SURVEY_ID (선택) — 응답이 있는 edu_survey id. 없으면 목록 첫 카드 선택
 *
 * 실행: npx playwright test e2e/admin-reports-tabs.spec.ts --reporter=list
 */

const REPORT_SURVEY_ID = process.env.E2E_ADMIN_REPORT_SURVEY_ID ?? "";

test.describe("admin reports 5 tabs", () => {
  test.beforeAll(() => {
    if (!hasAdminCreds()) {
      test.skip(true, "E2E_ADMIN_EMAIL/PASSWORD 미설정 — 스킵");
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("상세 진입 시 5탭 스트립이 보인다", async ({ page }) => {
    if (REPORT_SURVEY_ID) {
      await page.goto(`/admin/reports?survey=${REPORT_SURVEY_ID}`);
    } else {
      await page.goto("/admin/reports");
      await page.getByRole("link", { name: /보고서 생성/ }).first().click();
    }

    for (const label of ["요약", "개별 응답", "세그먼트", "VOC", "히트맵"]) {
      await expect(page.getByRole("tab", { name: label })).toBeVisible();
    }
  });

  test("탭 전환 시 URL 의 ?tab= 이 동기화된다", async ({ page }) => {
    if (REPORT_SURVEY_ID) {
      await page.goto(`/admin/reports?survey=${REPORT_SURVEY_ID}`);
    } else {
      await page.goto("/admin/reports");
      await page.getByRole("link", { name: /보고서 생성/ }).first().click();
    }

    await page.getByRole("tab", { name: "히트맵" }).click();
    await expect(page).toHaveURL(/[?&]tab=heatmap/);

    await page.getByRole("tab", { name: "세그먼트" }).click();
    await expect(page).toHaveURL(/[?&]tab=segments/);

    // summary 로 복귀 시 tab 파라미터 제거
    await page.getByRole("tab", { name: "요약" }).click();
    await expect(page).not.toHaveURL(/[?&]tab=/);
  });

  test("직접 URL 진입으로 특정 탭을 열 수 있다", async ({ page }) => {
    if (!REPORT_SURVEY_ID) {
      test.skip(true, "E2E_ADMIN_REPORT_SURVEY_ID 미설정 — 스킵");
    }
    await page.goto(`/admin/reports?survey=${REPORT_SURVEY_ID}&tab=verbatims`);
    await expect(page.getByRole("tab", { name: "VOC", selected: true })).toBeVisible();
  });

  test("각 탭에 고유한 콘텐츠가 렌더된다", async ({ page }) => {
    if (REPORT_SURVEY_ID) {
      await page.goto(`/admin/reports?survey=${REPORT_SURVEY_ID}`);
    } else {
      await page.goto("/admin/reports");
      await page.getByRole("link", { name: /보고서 생성/ }).first().click();
    }

    // 요약: "최고 만족 항목" 인사이트 카드
    await expect(page.getByText(/최고 만족 항목|아직 응답이 없습니다/)).toBeVisible();

    // 개별 응답: 응답자 매트릭스 or empty state
    await page.getByRole("tab", { name: "개별 응답" }).click();
    await expect(page.getByText(/응답자별 매트릭스|응답자 데이터가 없습니다/)).toBeVisible();

    // 세그먼트: 드롭다운
    await page.getByRole("tab", { name: "세그먼트" }).click();
    await expect(page.getByText(/세그먼트 비교|응답자 데이터가 없습니다/)).toBeVisible();

    // VOC
    await page.getByRole("tab", { name: "VOC" }).click();
    await expect(page.getByText(/주관식 답변|주관식 응답이 없습니다/)).toBeVisible();

    // 히트맵: 범례
    await page.getByRole("tab", { name: "히트맵" }).click();
    await expect(page.getByText(/응답자 × 문항 히트맵|응답자 또는 문항 데이터가 없습니다/)).toBeVisible();
  });
});
