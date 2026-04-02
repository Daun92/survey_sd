import { test, expect } from '@playwright/test'

/**
 * 설문 응답 폼 E2E 테스트
 *
 * 공통 링크(/s/:token)와 개인 링크(/d/:token) 경로에서
 * 동일한 기능이 정상 동작하는지 검증합니다.
 *
 * 환경 변수:
 *   E2E_SURVEY_TOKEN  - 공통 링크용 url_token (edu_surveys.url_token)
 *   E2E_DIST_TOKEN    - 개인 링크용 unique_token (distributions.unique_token)
 *   E2E_BASE_URL      - 기본: https://exc-survey.vercel.app
 */

const SURVEY_TOKEN = process.env.E2E_SURVEY_TOKEN || ''
const DIST_TOKEN = process.env.E2E_DIST_TOKEN || ''

/** 필수 응답자 정보 필드가 있으면 테스트 값으로 채움 */
async function fillRequiredFields(page: import('@playwright/test').Page) {
  const requiredInputs = page.locator('input[placeholder*="*"]')
  const count = await requiredInputs.count()
  for (let i = 0; i < count; i++) {
    const input = requiredInputs.nth(i)
    if (await input.isVisible() && await input.inputValue() === '') {
      await input.fill('테스트')
    }
  }
}

// ─── 공통 링크 (/s/:token) ───

test.describe('공통 링크 (/s/:token)', () => {
  test.skip(!SURVEY_TOKEN, 'E2E_SURVEY_TOKEN 환경변수 필요')

  test('시작 화면 렌더링', async ({ page }) => {
    await page.goto(`/s/${SURVEY_TOKEN}`)
    // 시작 버튼 존재
    await expect(page.getByText('설문 시작하기')).toBeVisible()
  })

  test('응답자 정보 필드 표시', async ({ page }) => {
    await page.goto(`/s/${SURVEY_TOKEN}`)
    // 응답자 정보 섹션이 보이는지 (collect_respondent_info가 true인 경우)
    const respondentSection = page.getByText('응답자 정보')
    // 존재하면 필드도 있어야 함
    if (await respondentSection.isVisible()) {
      const inputs = page.locator('input[placeholder*="이름"], input[placeholder*="소속"]')
      expect(await inputs.count()).toBeGreaterThan(0)
    }
  })

  test('문항 화면 진입', async ({ page }) => {
    await page.goto(`/s/${SURVEY_TOKEN}`)
    // 필수 응답자 정보가 있으면 채움
    await fillRequiredFields(page)
    await page.getByText('설문 시작하기').click()
    // 문항 번호가 보여야 함
    await expect(page.locator('text=01')).toBeVisible({ timeout: 5000 })
  })

  test('리커트 척도 프리셋 표시', async ({ page }) => {
    await page.goto(`/s/${SURVEY_TOKEN}`)
    await fillRequiredFields(page)
    await page.getByText('설문 시작하기').click()
    // 척도 버튼 (1~5) 존재
    await expect(page.locator('button:has-text("1")').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("5")').first()).toBeVisible()
    // 척도 라벨이 존재 (매우 만족, 매우 그렇다 등 어떤 것이든)
    const labels = page.locator('span.text-stone-400, span.text-\\[10px\\]')
    expect(await labels.count()).toBeGreaterThan(0)
  })
})

// ─── 개인 링크 (/d/:token) ───

test.describe('개인 링크 (/d/:token)', () => {
  test.skip(!DIST_TOKEN, 'E2E_DIST_TOKEN 환경변수 필요')

  test('시작 화면 렌더링', async ({ page }) => {
    await page.goto(`/d/${DIST_TOKEN}`)
    await expect(page.getByText('설문 시작하기')).toBeVisible()
  })

  test('응답자 정보 필드 표시 (빈 칸)', async ({ page }) => {
    await page.goto(`/d/${DIST_TOKEN}`)
    const respondentSection = page.getByText('응답자 정보')
    if (await respondentSection.isVisible()) {
      const nameInput = page.locator('input[placeholder*="이름"]').first()
      await expect(nameInput).toBeVisible()
      // 빈 칸이어야 함 (prefill 없음)
      await expect(nameInput).toHaveValue('')
    }
  })

  test('문항 화면 진입', async ({ page }) => {
    await page.goto(`/d/${DIST_TOKEN}`)
    await fillRequiredFields(page)
    await page.getByText('설문 시작하기').click()
    await expect(page.locator('text=01')).toBeVisible({ timeout: 5000 })
  })

  test('리커트 척도 프리셋 - metadata 반영 확인', async ({ page }) => {
    await page.goto(`/d/${DIST_TOKEN}`)
    await fillRequiredFields(page)
    await page.getByText('설문 시작하기').click()
    // 척도 버튼 존재
    await expect(page.locator('button:has-text("1")').first()).toBeVisible({ timeout: 5000 })
    // 척도 라벨이 존재
    const labels = page.locator('span.text-stone-400, span.text-\\[10px\\]')
    expect(await labels.count()).toBeGreaterThan(0)
  })
})

// ─── 공통/개인 링크 일관성 비교 ───

test.describe('경로 간 일관성', () => {
  test.skip(!SURVEY_TOKEN || !DIST_TOKEN, 'E2E_SURVEY_TOKEN, E2E_DIST_TOKEN 둘 다 필요')

  test('두 경로의 문항 수가 동일해야 함', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    // 공통 링크 → 문항 진입
    await page1.goto(`/s/${SURVEY_TOKEN}`)
    await fillRequiredFields(page1)
    await page1.getByText('설문 시작하기').click()
    await page1.waitForTimeout(1000)

    // 개인 링크 → 문항 진입
    await page2.goto(`/d/${DIST_TOKEN}`)
    await fillRequiredFields(page2)
    await page2.getByText('설문 시작하기').click()
    await page2.waitForTimeout(1000)

    // 문항 번호 개수 비교
    const count1 = await page1.locator('[id^="q-"]').count()
    const count2 = await page2.locator('[id^="q-"]').count()
    expect(count1).toBe(count2)
    expect(count1).toBeGreaterThan(0)

    await ctx1.close()
    await ctx2.close()
  })
})
