import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'
import path from 'node:path'

// .env.local 직접 로드 (Playwright 는 자동 로드 안 함).
loadDotenv({ path: path.resolve(process.cwd(), '.env.local'), override: false })

/**
 * 개인 링크(/d/:token) 의 중복 제출 차단 회귀 테스트.
 *
 * /api/surveys/[token]/submit 은 distribution_token 을 받으면
 * distributions.status === 'completed' 인 경우 400 으로 거절한다.
 * (src/app/api/surveys/[id]/submit/route.ts L73-75).
 *
 * 과거 회귀 패턴:
 *   - distribution 완료 처리 누락 → 재제출 허용
 *   - race condition 으로 두 번째 제출이 먼저 읽은 뒤 둘 다 성공
 *
 * ENV:
 *   E2E_BASE_URL                 — 테스트 대상 (playwright.config 기본값 프로덕션)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    — seed/cleanup
 *
 * 실행: npx playwright test e2e/respond-submit-duplicate.spec.ts --reporter=list
 */

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPA_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const clean = (v: string) => v.replace(/[\r\n\s]+$/g, '').trim()

let ctx: {
  surveyUrlToken: string
  surveyId: string
  distributionId: string
  distributionToken: string
  batchId: string
  respondentId: string | null
  submissionIds: string[]
} | null = null

test.describe('/d/[token] 중복 제출 차단', () => {
  test.beforeAll(async () => {
    test.skip(!SUPA_URL || !SUPA_SRK, 'Supabase 환경변수 필요')

    const sb = createClient(clean(SUPA_URL), clean(SUPA_SRK), {
      auth: { persistSession: false },
    })

    // 1. 활성 설문 1건 선택
    const { data: survey } = await sb
      .from('edu_surveys')
      .select('id, url_token, status')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (!survey) throw new Error('no active edu_surveys available for seed')

    // 2. 테스트 배치 생성 (is_test=true 로 집계에서 자동 제외)
    const { data: batch, error: bErr } = await sb
      .from('distribution_batches')
      .insert({
        survey_id: survey.id,
        channel: 'personal_link',
        total_count: 1,
        is_test: true,
      })
      .select('id')
      .single()
    if (bErr || !batch) throw new Error(`seed batch fail: ${bErr?.message}`)

    // 3. 테스트 distribution 1건 (고유 토큰 DB 트리거가 자동 생성)
    const { data: dist, error: dErr } = await sb
      .from('distributions')
      .insert({
        batch_id: batch.id,
        survey_id: survey.id,
        recipient_name: `E2E중복테스트${Date.now()}`,
        recipient_email: null,
        channel: 'personal_link',
        status: 'pending',
      })
      .select('id, unique_token')
      .single()
    if (dErr || !dist) throw new Error(`seed distribution fail: ${dErr?.message}`)

    ctx = {
      surveyUrlToken: survey.url_token,
      surveyId: survey.id,
      distributionId: dist.id,
      distributionToken: dist.unique_token,
      batchId: batch.id,
      respondentId: null,
      submissionIds: [],
    }
  })

  test.afterAll(async () => {
    if (!ctx || !SUPA_URL || !SUPA_SRK) return
    const sb = createClient(clean(SUPA_URL), clean(SUPA_SRK), {
      auth: { persistSession: false },
    })

    // edu_submissions (distribution 연계분) → distributions → distribution_batches 순 정리
    if (ctx.submissionIds.length > 0) {
      await sb.from('edu_submissions').delete().in('id', ctx.submissionIds)
    }
    await sb.from('distributions').delete().eq('id', ctx.distributionId)
    await sb.from('distribution_batches').delete().eq('id', ctx.batchId)
  })

  test('첫 제출은 200, 동일 토큰 재제출은 400 "이미 응답을 완료한 링크입니다"', async ({ request }) => {
    if (!ctx) throw new Error('seed ctx null')

    // 첫 번째 제출 — 성공
    const payload = {
      answers: {},
      respondent_name: 'E2E테스트응답자',
      distribution_token: ctx.distributionToken,
      is_test: true,
    }
    const first = await request.post(`/api/surveys/${ctx.surveyUrlToken}/submit`, {
      data: payload,
    })
    expect(first.status()).toBe(200)
    const body1 = await first.json()
    expect(body1.success).toBe(true)
    expect(body1.id).toBeTruthy()
    ctx.submissionIds.push(body1.id as string)

    // 두 번째 제출 — 거절
    const second = await request.post(`/api/surveys/${ctx.surveyUrlToken}/submit`, {
      data: payload,
    })
    expect(second.status()).toBe(400)
    const body2 = await second.json()
    expect(body2.error).toMatch(/이미 응답을 완료한 링크/)

    // DB 상태 검증: distribution 은 completed, submission 은 1건만 존재
    const sb = createClient(clean(SUPA_URL), clean(SUPA_SRK), {
      auth: { persistSession: false },
    })
    const { data: distCheck } = await sb
      .from('distributions')
      .select('status, completed_at')
      .eq('id', ctx.distributionId)
      .single()
    expect(distCheck?.status).toBe('completed')
    expect(distCheck?.completed_at).toBeTruthy()

    const { count } = await sb
      .from('edu_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('distribution_id', ctx.distributionId)
    expect(count).toBe(1)
  })
})
