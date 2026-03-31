"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createBatchSchema, type CreateBatchInput } from "@/lib/validations/distribution"
import { renderTemplate, getTemplateVariables } from "@/lib/email/template-renderer"
import { getEmailSender } from "@/lib/email/sender"

interface DistributionResult {
  name: string
  email: string
  uniqueToken: string
}

export async function createDistributionBatch(input: CreateBatchInput) {
  const parsed = createBatchSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { surveyId, rows } = parsed.data
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

  // 2. 고유 회사명 추출 → organizations upsert
  const uniqueCompanies = [...new Set(rows.map((r) => r.company).filter(Boolean))]
  const orgMap = new Map<string, string>() // company name → org id

  for (const companyName of uniqueCompanies) {
    // 기존 조직 검색
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", companyName)
      .limit(1)
      .single()

    if (existing) {
      orgMap.set(companyName, existing.id)
    } else {
      const { data: created } = await supabase
        .from("organizations")
        .insert({ name: companyName })
        .select("id")
        .single()
      if (created) orgMap.set(companyName, created.id)
    }
  }

  // 3. 응답자 upsert (이메일 기준 중복 체크)
  const respondentIds: string[] = []

  for (const row of rows) {
    const orgId = orgMap.get(row.company) ?? null

    // 이메일 기준 기존 응답자 검색
    let respondentId: string | null = null

    if (row.email) {
      const { data: existing } = await supabase
        .from("respondents")
        .select("id")
        .eq("email", row.email)
        .limit(1)
        .single()

      if (existing) {
        respondentId = existing.id
        // 조직 정보 업데이트
        await supabase
          .from("respondents")
          .update({
            name: row.name,
            organization_id: orgId,
            phone: row.phoneNormalized || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", respondentId)
      }
    }

    if (!respondentId) {
      const { data: created } = await supabase
        .from("respondents")
        .insert({
          name: row.name,
          email: row.email || null,
          phone: row.phoneNormalized || null,
          organization_id: orgId,
        })
        .select("id")
        .single()
      respondentId = created?.id ?? null
    }

    if (respondentId) {
      respondentIds.push(respondentId)
    }
  }

  // 4. distribution_batch 생성
  const { data: batch, error: batchErr } = await supabase
    .from("distribution_batches")
    .insert({
      survey_id: surveyId,
      channel: "personal_link",
      total_count: respondentIds.length,
    })
    .select("id")
    .single()

  if (batchErr || !batch) {
    return { error: "배포 배치 생성에 실패했습니다" }
  }

  // 5. distributions 일괄 생성
  const distributionInserts = rows.map((row, idx) => ({
    batch_id: batch.id,
    survey_id: surveyId,
    respondent_id: respondentIds[idx] ?? null,
    recipient_email: row.email || null,
    recipient_name: row.name,
    channel: "personal_link",
    status: "pending",
  }))

  const { data: distributions, error: distErr } = await supabase
    .from("distributions")
    .insert(distributionInserts)
    .select("id, recipient_name, recipient_email, unique_token")

  if (distErr || !distributions) {
    return { error: "개인 링크 생성에 실패했습니다: " + (distErr?.message ?? "") }
  }

  // 6. respondents의 last_cs_survey_sent_at 업데이트
  const now = new Date().toISOString()
  await supabase
    .from("respondents")
    .update({ last_cs_survey_sent_at: now })
    .in("id", respondentIds)

  // 7. 결과 반환
  const results: DistributionResult[] = distributions.map((d) => ({
    name: d.recipient_name ?? "",
    email: d.recipient_email ?? "",
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

  // 2. 고유 회사명 추출 → organizations upsert
  const uniqueCompanies = [...new Set(rows.map((r) => r.company).filter(Boolean))]
  const orgMap = new Map<string, string>()

  for (const companyName of uniqueCompanies) {
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", companyName)
      .limit(1)
      .single()

    if (existing) {
      orgMap.set(companyName, existing.id)
    } else {
      const { data: created } = await supabase
        .from("organizations")
        .insert({ name: companyName })
        .select("id")
        .single()
      if (created) orgMap.set(companyName, created.id)
    }
  }

  // 3. 응답자 upsert
  const respondentIds: string[] = []

  for (const row of rows) {
    const orgId = orgMap.get(row.company) ?? null
    let respondentId: string | null = null

    if (row.email) {
      const { data: existing } = await supabase
        .from("respondents")
        .select("id")
        .eq("email", row.email)
        .limit(1)
        .single()

      if (existing) {
        respondentId = existing.id
        await supabase
          .from("respondents")
          .update({
            name: row.name,
            organization_id: orgId,
            phone: row.phoneNormalized || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", respondentId)
      }
    }

    if (!respondentId) {
      const { data: created } = await supabase
        .from("respondents")
        .insert({
          name: row.name,
          email: row.email || null,
          phone: row.phoneNormalized || null,
          organization_id: orgId,
        })
        .select("id")
        .single()
      respondentId = created?.id ?? null
    }

    if (respondentId) {
      respondentIds.push(respondentId)
    }
  }

  // 4. distributions 추가 생성
  const distributionInserts = rows.map((row, idx) => ({
    batch_id: batchId,
    survey_id: surveyId,
    respondent_id: respondentIds[idx] ?? null,
    recipient_email: row.email || null,
    recipient_name: row.name,
    channel: "personal_link",
    status: "pending",
  }))

  const { data: distributions, error: distErr } = await supabase
    .from("distributions")
    .insert(distributionInserts)
    .select("id, recipient_name, recipient_email, unique_token")

  if (distErr || !distributions) {
    return { error: "추가 링크 생성 실패: " + (distErr?.message ?? "") }
  }

  // 5. 배치 total_count 업데이트
  await supabase
    .from("distribution_batches")
    .update({ total_count: batch.total_count + distributions.length })
    .eq("id", batchId)

  // 6. respondents의 last_cs_survey_sent_at 업데이트
  const now = new Date().toISOString()
  await supabase
    .from("respondents")
    .update({ last_cs_survey_sent_at: now })
    .in("id", respondentIds)

  const results: DistributionResult[] = distributions.map((d) => ({
    name: d.recipient_name ?? "",
    email: d.recipient_email ?? "",
    uniqueToken: d.unique_token,
  }))

  return { batchId, distributions: results }
}

// ─── 메일 템플릿 목록 (클라이언트에서 사용) ───

export async function getEmailTemplates() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("email_templates")
    .select("id, name, subject, body_html, is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  return (data ?? []) as {
    id: string
    name: string
    subject: string
    body_html: string
    is_default: boolean
  }[]
}

// ─── 메일 발송 큐 등록 ───

interface ScheduleEmailInput {
  batchId: string
  templateId: string
  scheduleType: "immediate" | "scheduled" | "trigger"
  scheduledAt?: string
  triggerRule?: { type: string; days: number }
  customSubject?: string
  customBodyHtml?: string
}

export async function scheduleEmailBatch(
  input: ScheduleEmailInput
): Promise<{ queued?: number; error?: string }> {
  const supabase = createAdminClient()

  // 1. 템플릿 조회
  const { data: template, error: tplErr } = await supabase
    .from("email_templates")
    .select("id, subject, body_html")
    .eq("id", input.templateId)
    .single()

  if (tplErr || !template) {
    return { error: "템플릿을 찾을 수 없습니다" }
  }

  // 2. 배치의 모든 distributions 조회 (응답자 + 설문 정보 포함)
  const { data: distributions, error: distErr } = await supabase
    .from("distributions")
    .select(`
      id, unique_token, recipient_name, recipient_email,
      respondent_id,
      edu_surveys ( id, title, url_token,
        sessions ( name,
          courses ( name,
            projects ( name, customers ( company_name ) )
          )
        )
      )
    `)
    .eq("batch_id", input.batchId)

  if (distErr || !distributions || distributions.length === 0) {
    return { error: "배포 데이터를 찾을 수 없습니다" }
  }

  // 3. 각 distribution별로 변수 맵 생성 → 렌더링 → 큐 적재
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"

  const queueInserts = distributions
    .filter((d) => d.recipient_email)
    .map((d) => {
      const survey = d.edu_surveys as any
      const session = survey?.sessions as any
      const course = session?.courses as any
      const project = course?.projects as any
      const companyName = project?.customers?.company_name ?? ""

      const vars = getTemplateVariables({
        recipientName: d.recipient_name ?? undefined,
        companyName,
        courseName: course?.name ?? survey?.title ?? "",
        surveyLink: `${baseUrl}/d/${d.unique_token}`,
      })

      return {
        distribution_id: d.id,
        template_id: template.id,
        recipient_email: d.recipient_email!,
        recipient_name: d.recipient_name ?? null,
        subject: renderTemplate(input.customSubject ?? template.subject, vars),
        body_html: renderTemplate(input.customBodyHtml ?? template.body_html, vars),
        schedule_type: input.scheduleType,
        scheduled_at:
          input.scheduleType === "scheduled" && input.scheduledAt
            ? new Date(input.scheduledAt).toISOString()
            : input.scheduleType === "immediate"
            ? new Date().toISOString()
            : null,
        trigger_rule:
          input.scheduleType === "trigger" ? input.triggerRule : null,
        status: "pending",
      }
    })

  if (queueInserts.length === 0) {
    return { error: "발송 가능한 수신자가 없습니다" }
  }

  const { error: insertErr } = await supabase
    .from("email_queue")
    .insert(queueInserts)

  if (insertErr) {
    return { error: "큐 등록 실패: " + insertErr.message }
  }

  // 4. 즉시 발송인 경우 바로 처리
  if (input.scheduleType === "immediate") {
    const sender = getEmailSender()
    const { data: pendingQueue } = await supabase
      .from("email_queue")
      .select("id, recipient_email, recipient_name, subject, body_html, distribution_id")
      .eq("status", "pending")
      .in(
        "distribution_id",
        distributions.map((d) => d.id)
      )

    for (const item of pendingQueue ?? []) {
      await supabase
        .from("email_queue")
        .update({ status: "processing" })
        .eq("id", item.id)

      const result = await sender.send({
        to: item.recipient_email,
        toName: item.recipient_name ?? undefined,
        subject: item.subject,
        bodyHtml: item.body_html,
      })

      if (result.success) {
        await supabase
          .from("email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id)

        // distribution 상태도 sent로 업데이트
        await supabase
          .from("distributions")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.distribution_id)
      } else {
        await supabase
          .from("email_queue")
          .update({
            status: "failed",
            last_error: result.error ?? "Unknown error",
            retry_count: 1,
          })
          .eq("id", item.id)
      }
    }
  }

  return { queued: queueInserts.length }
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

// ─── 테스트 메일 발송 (큐 미사용, 직접 발송) ───

export async function sendTestEmail(input: {
  templateId: string
  testEmail: string
  customSubject?: string
  customBodyHtml?: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { data: template, error: tplErr } = await supabase
    .from("email_templates")
    .select("id, subject, body_html")
    .eq("id", input.templateId)
    .single()

  if (tplErr || !template) {
    return { error: "템플릿을 찾을 수 없습니다" }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"
  const vars = getTemplateVariables({
    recipientName: "홍길동",
    companyName: "(주)엑셀루트",
    courseName: "리더십 스킬 향상 과정",
    surveyLink: `${baseUrl}/d/test-preview-link`,
    educationEndDate: "2026-04-15",
  })

  const subject = `[테스트] ${renderTemplate(input.customSubject ?? template.subject, vars)}`
  const bodyHtml = renderTemplate(input.customBodyHtml ?? template.body_html, vars)

  const sender = getEmailSender()
  const result = await sender.send({
    to: input.testEmail,
    toName: "테스트 수신자",
    subject,
    bodyHtml,
  })

  if (result.success) {
    return { success: true }
  }
  return { error: result.error ?? "발송 실패" }
}
