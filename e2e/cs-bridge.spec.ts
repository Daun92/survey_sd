import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config as loadDotenv } from 'dotenv'
import path from 'node:path'

// .env.local 직접 로드 (Playwright 자동 로드 안 함 + Git Bash MSYS path conversion 회피)
loadDotenv({ path: path.resolve(process.cwd(), '.env.local'), override: false })

/**
 * cs-bridge API E2E 테스트
 *
 * POST /api/distributions/cs-bridge 의 핵심 경로를 자동 회귀한다.
 *
 * 환경변수:
 *   E2E_BASE_URL               — 테스트 대상 서버 (playwright.config 기본값 프로덕션)
 *   CS_BRIDGE_API_KEY          — 서버에 등록된 값과 동일해야 200 진행
 *   NEXT_PUBLIC_SUPABASE_URL   — Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY  — seed/cleanup용 service_role
 *
 * 실행:
 *   npx playwright test e2e/cs-bridge.spec.ts --reporter=list
 *
 * 설계: docs/cs-integration/phase1-spec.md §6-2
 */

const BRIDGE_PATH = '/api/distributions/cs-bridge'

const BRIDGE_KEY = process.env.CS_BRIDGE_API_KEY ?? ''
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPA_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/** env 값 trailing whitespace / literal "\n" 방어 */
const clean = (v: string) => v.replace(/[\r\n\s]+$/g, '').trim()

// seed 컨텍스트 공유
let ctx: {
  batchId: string
  surveyId: string
  targetIds: string[]
  contactIds: string[]
  projectIds: string[]
} | null = null

test.describe('cs-bridge API', () => {
  test.beforeAll(async () => {
    test.skip(!BRIDGE_KEY, 'CS_BRIDGE_API_KEY 환경변수 필요')
    test.skip(!SUPA_URL || !SUPA_SRK, 'Supabase 환경변수 필요')

    const sb = createClient(clean(SUPA_URL), clean(SUPA_SRK), {
      auth: { persistSession: false },
    })

    // 1. 테스트용 edu_surveys 1건 선택 (임의 활성/초안/종결)
    const { data: survey } = await sb
      .from('edu_surveys')
      .select('id')
      .limit(1)
      .maybeSingle()
    if (!survey) throw new Error('no edu_surveys available for seed')

    // 2. 임의 cs_contacts / cs_projects 3건씩
    const { data: contacts } = await sb.from('cs_contacts').select('id').limit(3)
    const { data: projects } = await sb.from('cs_projects').select('id').limit(3)
    if (!contacts?.length || !projects?.length) {
      throw new Error('no cs_contacts/cs_projects for seed')
    }
    const contactIds = contacts.map((c) => c.id as string)
    const projectIds = projects.map((p) => p.id as string)

    // 3. 테스트 배치 생성
    const { data: batch, error: bErr } = await sb
      .from('cs_target_batches')
      .insert({
        batch_name: `e2e-cs-bridge-${Date.now()}`,
        survey_id: survey.id,
        status: 'confirmed',
        total_candidates: 3,
        eligible_count: 3,
      })
      .select('id')
      .single()
    if (bErr || !batch) throw new Error(`seed batch fail: ${bErr?.message}`)

    // 4. 타깃 3건
    const targetRows = [0, 1, 2].map((i) => ({
      batch_id: batch.id,
      contact_id: contactIds[i % contactIds.length],
      project_id: projectIds[i % projectIds.length],
      is_eligible: true,
      step5_confirmed: true,
      step5_confirmed_at: new Date().toISOString(),
      status: 'eligible',
      current_step: 5,
    }))
    const { data: targets, error: tErr } = await sb
      .from('cs_survey_targets')
      .insert(targetRows)
      .select('id')
    if (tErr || !targets?.length) throw new Error(`seed targets fail: ${tErr?.message}`)

    ctx = {
      batchId: batch.id as string,
      surveyId: survey.id as string,
      targetIds: targets.map((t) => t.id as string),
      contactIds,
      projectIds,
    }
  })

  test.afterAll(async () => {
    if (!ctx || !SUPA_URL || !SUPA_SRK) return
    const sb = createClient(clean(SUPA_URL), clean(SUPA_SRK), {
      auth: { persistSession: false },
    })

    // distributions · distribution_batches · cs_survey_targets · cs_target_batches 순으로 정리
    await sb
      .from('distributions')
      .delete()
      .in(
        'batch_id',
        (
          await sb
            .from('distribution_batches')
            .select('id')
            .eq('source', 'cs-bridge')
            .eq('source_batch_id', ctx.batchId)
        ).data?.map((b: any) => b.id) ?? [],
      )
    await sb
      .from('distribution_batches')
      .delete()
      .eq('source', 'cs-bridge')
      .eq('source_batch_id', ctx.batchId)
    await sb.from('cs_survey_targets').delete().eq('batch_id', ctx.batchId)
    await sb.from('cs_target_batches').delete().eq('id', ctx.batchId)
  })

  test('401 — bridge key 없음', async ({ request }) => {
    const res = await request.post(BRIDGE_PATH, { data: {} })
    expect(res.status()).toBe(401)
  })

  test('401 — bridge key 불일치', async ({ request }) => {
    const res = await request.post(BRIDGE_PATH, {
      data: {},
      headers: { 'x-cs-bridge-key': 'wrong-key' },
    })
    expect(res.status()).toBe(401)
  })

  test('400 — 잘못된 payload (batchId 누락)', async ({ request }) => {
    const res = await request.post(BRIDGE_PATH, {
      data: {},
      headers: { 'x-cs-bridge-key': BRIDGE_KEY },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/batchId/)
  })

  test('404 — 존재하지 않는 batch', async ({ request }) => {
    const res = await request.post(BRIDGE_PATH, {
      data: {
        batchId: '00000000-0000-0000-0000-000000000000',
        targets: [{ targetId: '00000000-0000-0000-0000-000000000000' }],
      },
      headers: { 'x-cs-bridge-key': BRIDGE_KEY },
    })
    expect(res.status()).toBe(404)
  })

  test('405 — GET', async ({ request }) => {
    const res = await request.get(BRIDGE_PATH)
    expect(res.status()).toBe(405)
  })

  test('200 — happy path (3건 dispatched)', async ({ request }) => {
    if (!ctx) throw new Error('seed ctx null')

    const res = await request.post(BRIDGE_PATH, {
      data: {
        batchId: ctx.batchId,
        channel: 'auto',
        targets: ctx.targetIds.map((id, i) => ({
          targetId: id,
          name: `E2E타깃${i + 1}`,
          email: `e2e-target-${i}@example.com`,
          phone: `010-0000-${String(1000 + i).padStart(4, '0')}`,
          company: `E2E회사${i + 1}`,
        })),
      },
      headers: { 'x-cs-bridge-key': BRIDGE_KEY },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.dispatched).toBe(3)
    expect(body.skipped).toBe(0)
    expect(body.errors).toBe(0)
    expect(body.results).toHaveLength(3)
    for (const r of body.results) {
      expect(r.status).toBe('dispatched')
      expect(r.distributionId).toBeTruthy()
      expect(r.token).toMatch(/^[a-f0-9]{12}$/)
      expect(r.surveyUrl).toMatch(/^https?:\/\/.+\/d\/[a-f0-9]{12}$/)
      expect(r.channel).toBe('email') // email 제공 → auto 경로 email 선택
    }
  })

  test('200 — 재호출은 모두 skipped (already_dispatched)', async ({ request }) => {
    if (!ctx) throw new Error('seed ctx null')

    const res = await request.post(BRIDGE_PATH, {
      data: {
        batchId: ctx.batchId,
        channel: 'auto',
        targets: ctx.targetIds.map((id) => ({
          targetId: id,
          email: 'different@example.com',
        })),
      },
      headers: { 'x-cs-bridge-key': BRIDGE_KEY },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.dispatched).toBe(0)
    expect(body.skipped).toBe(3)
    for (const r of body.results) {
      expect(r.status).toBe('skipped')
      expect(r.reason).toBe('already_dispatched')
    }
  })

  test('DB writeback — cs_survey_targets + distributions + distribution_batch', async () => {
    if (!ctx) throw new Error('seed ctx null')
    const sb = createClient(clean(SUPA_URL), clean(SUPA_SRK), {
      auth: { persistSession: false },
    })

    // 1. cs_survey_targets 3건 모두 distribution_id / dispatched_at 채워짐
    const { data: targets } = await sb
      .from('cs_survey_targets')
      .select('id, distribution_id, survey_token, survey_url, dispatched_at, status, dispatch_channel')
      .in('id', ctx.targetIds)
    expect(targets?.length).toBe(3)
    for (const t of targets ?? []) {
      expect(t.distribution_id).toBeTruthy()
      expect(t.survey_token).toMatch(/^[a-f0-9]{12}$/)
      expect(t.survey_url).toMatch(/^https?:\/\/.+\/d\/[a-f0-9]{12}$/)
      expect(t.dispatched_at).toBeTruthy()
      expect(t.status).toBe('dispatched')
    }

    // 2. distribution_batches 1건 (source=cs-bridge, source_batch_id=ctx.batchId)
    const { data: batches } = await sb
      .from('distribution_batches')
      .select('id, total_count, source, source_batch_id, survey_id')
      .eq('source', 'cs-bridge')
      .eq('source_batch_id', ctx.batchId)
    expect(batches?.length).toBe(1)
    expect(batches?.[0]?.total_count).toBe(3)
    expect(batches?.[0]?.survey_id).toBe(ctx.surveyId)

    // 3. distributions 3건, unique_token 형식 정상
    const { data: dists } = await sb
      .from('distributions')
      .select('id, unique_token, recipient_email, channel, status')
      .eq('batch_id', batches?.[0]?.id)
    expect(dists?.length).toBe(3)
    for (const d of dists ?? []) {
      expect(d.unique_token).toMatch(/^[a-f0-9]{12}$/)
      expect(d.channel).toBe('email')
      expect(d.status).toBe('pending')
    }
  })
})
