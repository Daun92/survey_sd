"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createBatchSchema, type CreateBatchInput } from "@/lib/validations/distribution"

interface DistributionResult {
  name: string
  company: string
  email: string
  phone: string
  uniqueToken: string
}

type AdminSupabase = ReturnType<typeof createAdminClient>

/**
 * 주어진 회사명 목록을 customers 테이블과 대조해 company_name → customer_id 매핑을 만든다.
 * 한 회사명에 매칭되는 customer 가 정확히 1건일 때만 id 를 반환한다.
 * (동일 회사명이 여러 service_type 으로 존재하는 경우는 모호하므로 매핑하지 않고 null 로 둔다.)
 */
async function buildCustomerMap(
  supabase: AdminSupabase,
  companyNames: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (companyNames.length === 0) return map

  const { data: customers } = await supabase
    .from("customers")
    .select("id, company_name")
    .in("company_name", companyNames)

  if (!customers) return map

  // 같은 company_name 이 둘 이상이면 모호 → 매핑 제외
  const counts = new Map<string, number>()
  for (const c of customers) counts.set(c.company_name, (counts.get(c.company_name) ?? 0) + 1)
  for (const c of customers) {
    if (counts.get(c.company_name) === 1) map.set(c.company_name, c.id)
  }
  return map
}

/**
 * CSV/수동 입력 rows 를 respondents 테이블에 upsert 한다.
 * - 이메일 기준 중복 체크 (있으면 update, 없으면 insert)
 * - customer_id 는 company_name 단일 매칭 시에만 세팅, 아니면 null
 * 반환값: rows 와 동일 순서의 respondent id 배열 (실패한 row 는 null 대신 빈 문자열 제외)
 */
async function upsertRespondents(
  supabase: AdminSupabase,
  rows: CreateBatchInput["rows"]
): Promise<string[]> {
  const uniqueCompanies = [...new Set(rows.map((r) => r.company).filter(Boolean))]
  const customerMap = await buildCustomerMap(supabase, uniqueCompanies)

  const respondentIds: string[] = []
  for (const row of rows) {
    const customerId = row.company ? customerMap.get(row.company) ?? null : null
    let respondentId: string | null = null

    if (row.email) {
      const { data: existing } = await supabase
        .from("respondents")
        .select("id")
        .eq("email", row.email)
        .limit(1)
        .maybeSingle()

      if (existing) {
        respondentId = existing.id
        await supabase
          .from("respondents")
          .update({
            name: row.name,
            phone: row.phoneNormalized || null,
            // customer_id 는 NULL 을 덮어쓰는 경우에만 세팅 (기존 customer_id 보존)
            ...(customerId !== null ? { customer_id: customerId } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", respondentId)
      }
    }

    if (!respondentId) {
      const { data: created, error: insertErr } = await supabase
        .from("respondents")
        .insert({
          name: row.name,
          email: row.email || null,
          phone: row.phoneNormalized || null,
          customer_id: customerId,
        })
        .select("id")
        .single()
      if (insertErr) {
        console.error("[upsertRespondents] insert 실패:", insertErr.message, { name: row.name, email: row.email })
      }
      respondentId = created?.id ?? null
    }

    if (respondentId) respondentIds.push(respondentId)
    else respondentIds.push("") // 순서 보존용 placeholder
  }

  return respondentIds
}

export async function createDistributionBatch(input: CreateBatchInput) {
  const parsed = createBatchSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { surveyId, rows, isTest } = parsed.data
  const supabase = createAdminClient()

  // 1. 설문 존재 확인
  const { data: survey, error: surveyErr } = await supabase
    .from("edu_surveys")
    .select("id, title, status")
    .eq("id", surveyId)
    .single()

  if (surveyErr || !survey) {
    return { error: "설문을 찾을 수 없습니다" }
  }

  // 2. 응답자 upsert (customer_id 는 company_name 단일 매칭 시 자동 세팅)
  const respondentIds = await upsertRespondents(supabase, rows)
  const validRespondentIds = respondentIds.filter((id) => id !== "")

  // 3. distribution_batch 생성
  const { data: batch, error: batchErr } = await supabase
    .from("distribution_batches")
    .insert({
      survey_id: surveyId,
      channel: "personal_link",
      total_count: validRespondentIds.length,
      is_test: isTest,
    })
    .select("id")
    .single()

  if (batchErr || !batch) {
    return { error: "배포 배치 생성에 실패했습니다" }
  }

  // 4. distributions 일괄 생성 (respondent_id 는 upsert 에서 확보한 id, 실패 행은 null)
  const distributionInserts = rows.map((row, idx) => ({
    batch_id: batch.id,
    survey_id: surveyId,
    respondent_id: respondentIds[idx] || null,
    recipient_email: row.email || null,
    recipient_name: row.name,
    recipient_company: row.company || null,
    recipient_phone: row.phoneNormalized || null,
    channel: "personal_link",
    status: "pending",
  }))

  const { data: distributions, error: distErr } = await supabase
    .from("distributions")
    .insert(distributionInserts)
    .select("id, recipient_name, recipient_company, recipient_email, recipient_phone, unique_token")

  if (distErr || !distributions) {
    // distributions insert 실패 시 orphan batch 를 정리 (부분 성공으로 인한 DB 불일치 방지).
    // Supabase 는 RLS 하 트랜잭션 미지원이므로 RPC 대신 compensating delete 로 에뮬레이트.
    const { error: cleanupErr } = await supabase
      .from("distribution_batches")
      .delete()
      .eq("id", batch.id)
    if (cleanupErr) {
      console.error("[createDistributionBatch] orphan batch cleanup 실패", {
        batchId: batch.id,
        distErr: distErr?.message,
        cleanupErr: cleanupErr.message,
      })
    }
    return { error: "개인 링크 생성에 실패했습니다: " + (distErr?.message ?? "") }
  }

  // 5. respondents 의 last_cs_survey_sent_at 갱신 (유효 id 만)
  if (validRespondentIds.length > 0) {
    const now = new Date().toISOString()
    await supabase
      .from("respondents")
      .update({ last_cs_survey_sent_at: now })
      .in("id", validRespondentIds)
  }

  // 7. 결과 반환
  const results: DistributionResult[] = distributions.map((d) => ({
    name: d.recipient_name ?? "",
    company: (d as any).recipient_company ?? "",
    email: d.recipient_email ?? "",
    phone: (d as any).recipient_phone ?? "",
    uniqueToken: d.unique_token,
  }))

  return {
    batchId: batch.id,
    distributions: results,
  }
}

// ─── 기존 배치에 대상자 추가 ───

export async function addToDistributionBatch(input: {
  batchId: string
  surveyId: string
  rows: CreateBatchInput["rows"]
}) {
  const { batchId, surveyId, rows } = input
  const supabase = createAdminClient()

  // 1. 배치 존재 확인
  const { data: batch, error: batchErr } = await supabase
    .from("distribution_batches")
    .select("id, survey_id, total_count")
    .eq("id", batchId)
    .single()

  if (batchErr || !batch) {
    return { error: "배부 배치를 찾을 수 없습니다" }
  }
  if (batch.survey_id !== surveyId) {
    return { error: "설문 ID가 일치하지 않습니다" }
  }

  // 2. 응답자 upsert (customer_id 는 company_name 단일 매칭 시 자동 세팅)
  const respondentIds = await upsertRespondents(supabase, rows)
  const validRespondentIds = respondentIds.filter((id) => id !== "")

  // 3. distributions 추가 생성
  const distributionInserts = rows.map((row, idx) => ({
    batch_id: batchId,
    survey_id: surveyId,
    respondent_id: respondentIds[idx] || null,
    recipient_email: row.email || null,
    recipient_name: row.name,
    recipient_company: row.company || null,
    recipient_phone: row.phoneNormalized || null,
    channel: "personal_link",
    status: "pending",
  }))

  const { data: distributions, error: distErr } = await supabase
    .from("distributions")
    .insert(distributionInserts)
    .select("id, recipient_name, recipient_company, recipient_email, recipient_phone, unique_token")

  if (distErr || !distributions) {
    return { error: "추가 링크 생성 실패: " + (distErr?.message ?? "") }
  }

  // 4. 배치 total_count 업데이트
  await supabase
    .from("distribution_batches")
    .update({ total_count: batch.total_count + distributions.length })
    .eq("id", batchId)

  // 5. respondents 의 last_cs_survey_sent_at 갱신
  if (validRespondentIds.length > 0) {
    const now = new Date().toISOString()
    await supabase
      .from("respondents")
      .update({ last_cs_survey_sent_at: now })
      .in("id", validRespondentIds)
  }

  const results: DistributionResult[] = distributions.map((d) => ({
    name: d.recipient_name ?? "",
    company: (d as any).recipient_company ?? "",
    email: d.recipient_email ?? "",
    phone: (d as any).recipient_phone ?? "",
    uniqueToken: d.unique_token,
  }))

  return { batchId, distributions: results }
}


// ─── 배부 배치 목록 조회 ───
export async function getDistributionBatches() {
  const supabase = createAdminClient()
  const { data: batches } = await supabase
    .from('distribution_batches')
    .select(`
      id, survey_id, channel, total_count, sent_count, opened_count, completed_count, created_at,
      edu_surveys ( title, status )
    `)
    .order('created_at', { ascending: false })

  return (batches ?? []).map((b: any) => ({
    id: b.id,
    surveyId: b.survey_id,
    surveyTitle: b.edu_surveys?.title ?? '(삭제된 설문)',
    surveyStatus: b.edu_surveys?.status ?? 'unknown',
    channel: b.channel,
    totalCount: b.total_count,
    sentCount: b.sent_count,
    openedCount: b.opened_count,
    completedCount: b.completed_count,
    createdAt: b.created_at,
  }))
}

// ─── 배치 내 개별 배부 목록 조회 ───
export async function getDistributions(batchId: string) {
  const supabase = createAdminClient()
  const { data: distributions } = await supabase
    .from('distributions')
    .select('id, recipient_name, recipient_email, recipient_company, recipient_department, recipient_position, recipient_phone, unique_token, status, sent_at, opened_at, started_at, completed_at, created_at')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })

  return distributions ?? []
}

// ─── 배부 배치 삭제 ───
export async function deleteDistributionBatch(batchId: string) {
  const supabase = createAdminClient()
  // distributions는 CASCADE로 자동 삭제
  const { error } = await supabase
    .from('distribution_batches')
    .delete()
    .eq('id', batchId)

  if (error) {
    console.error('Batch deletion error:', error)
    return { error: '배부 배치 삭제에 실패했습니다' }
  }

  return { success: true }
}

// ═══════════════════════════════════════════════
// 이메일 / SMS 발송·프로바이더 관리 → 채널별 파일 분리 (A-2-a Phase 1-2)
//   email  → ./email-actions.ts
//   sms    → ./sms-actions.ts
//   callers: email-send-panel / email-provider-settings / sms-send-panel /
//            sms-provider-settings / distribute-tabs
// ═══════════════════════════════════════════════

// ============================================
// 배치 라벨 갱신 — 사용자가 차수 자동 번호 대신 커스텀 이름을 부여할 때 사용
// 빈 문자열 또는 null 을 넘기면 라벨 제거 (자동 "N차" 표시로 돌아감)
// ============================================
export async function updateBatchLabel(batchId: string, label: string | null) {
  if (!batchId) return { error: "batchId 가 필요합니다" }

  const trimmed = label === null ? null : label.trim()
  const next = trimmed === "" ? null : trimmed

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("distribution_batches")
    .update({ label: next })
    .eq("id", batchId)

  if (error) {
    return { error: "라벨 저장 실패: " + error.message }
  }

  return { label: next }
}
