"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createBatchSchema, type CreateBatchInput } from "@/lib/validations/distribution"
import { renderTemplate, getTemplateVariables } from "@/lib/email/template-renderer"
import { getEmailSender, getEmailSenderFromDB, isEmailConfigured, createSenderFromConfig } from "@/lib/email/sender"
import type { EmailProviderType, EmailProviderConfig } from "@/lib/email/types"
import { getSmsSenderFromDB, createSmsFromConfig } from "@/lib/sms/sender"
import type { SmsProviderType, SmsProviderConfig } from "@/lib/sms/types"
import { renderTemplate as renderSmsTemplate, getTemplateVariables as getSmsTemplateVariables, getSmsMessageType } from "@/lib/sms/template-renderer"

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
      is_test: isTest,
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
    const sender = await getEmailSenderFromDB()
    if (sender.isMock) {
      return { error: "메일 발송 설정이 완료되지 않았습니다. 이메일 제공자를 설정하거나 환경변수를 확인하세요." }
    }
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

  const sender = await getEmailSenderFromDB()
  if (sender.isMock) {
    return { error: "메일 발송 설정이 완료되지 않았습니다. 이메일 제공자를 설정하거나 환경변수를 확인하세요." }
  }

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

// ─── 개별 재발송 ───

export async function resendDistributionEmail(
  distributionId: string
): Promise<{ success?: boolean; error?: string }> {

  const supabase = createAdminClient()

  // 1. distribution 조회
  const { data: dist, error: distErr } = await supabase
    .from("distributions")
    .select("id, unique_token, recipient_name, recipient_email, batch_id, status")
    .eq("id", distributionId)
    .single()

  if (distErr || !dist) {
    return { error: "배부 데이터를 찾을 수 없습니다" }
  }
  if (!dist.recipient_email) {
    return { error: "수신자 이메일이 없습니다" }
  }
  if (dist.status === "completed") {
    return { error: "이미 설문을 완료한 수신자입니다" }
  }

  // 2. 기존 email_queue에서 subject/body 가져오기
  const { data: prevQueue } = await supabase
    .from("email_queue")
    .select("subject, body_html")
    .eq("distribution_id", distributionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  let subject: string
  let bodyHtml: string

  if (prevQueue) {
    subject = prevQueue.subject
    bodyHtml = prevQueue.body_html
  } else {
    // 기본 템플릿으로 렌더링
    const { data: defaultTpl } = await supabase
      .from("email_templates")
      .select("subject, body_html")
      .eq("is_default", true)
      .limit(1)
      .single()

    if (!defaultTpl) {
      return { error: "기본 이메일 템플릿을 찾을 수 없습니다" }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"
    const vars = getTemplateVariables({
      recipientName: dist.recipient_name ?? undefined,
      surveyLink: `${baseUrl}/d/${dist.unique_token}`,
    })

    subject = renderTemplate(defaultTpl.subject, vars)
    bodyHtml = renderTemplate(defaultTpl.body_html, vars)
  }

  // 3. email_queue에 insert
  const now = new Date().toISOString()
  const { data: queueItem, error: insertErr } = await supabase
    .from("email_queue")
    .insert({
      distribution_id: dist.id,
      recipient_email: dist.recipient_email,
      recipient_name: dist.recipient_name,
      subject,
      body_html: bodyHtml,
      schedule_type: "immediate",
      scheduled_at: now,
      status: "pending",
    })
    .select("id")
    .single()

  if (insertErr || !queueItem) {
    return { error: "큐 등록 실패: " + (insertErr?.message ?? "Unknown") }
  }

  // 4. 즉시 발송
  await supabase
    .from("email_queue")
    .update({ status: "processing" })
    .eq("id", queueItem.id)

  const sender = await getEmailSenderFromDB()
  if (sender.isMock) {
    return { error: "메일 발송 설정이 완료되지 않았습니다. 이메일 제공자를 설정하거나 환경변수를 확인하세요." }
  }
  const result = await sender.send({
    to: dist.recipient_email,
    toName: dist.recipient_name ?? undefined,
    subject,
    bodyHtml,
  })

  if (result.success) {
    await supabase
      .from("email_queue")
      .update({ status: "sent", sent_at: now })
      .eq("id", queueItem.id)

    await supabase
      .from("distributions")
      .update({ status: "sent", sent_at: now })
      .eq("id", dist.id)

    return { success: true }
  }

  await supabase
    .from("email_queue")
    .update({ status: "failed", last_error: result.error ?? "Unknown error" })
    .eq("id", queueItem.id)

  return { error: result.error ?? "발송 실패" }
}

// ─── 배치 미응답자 일괄 재발송 ───

export async function resendBatchEmails(
  batchId: string
): Promise<{ sent?: number; failed?: number; error?: string }> {
  const supabase = createAdminClient()

  // 미완료 & 이메일 있는 distribution 조회
  const { data: distributions, error: distErr } = await supabase
    .from("distributions")
    .select("id, unique_token, recipient_name, recipient_email, status")
    .eq("batch_id", batchId)
    .neq("status", "completed")
    .not("recipient_email", "is", null)

  if (distErr || !distributions || distributions.length === 0) {
    return { error: "재발송 대상이 없습니다" }
  }

  const sender = await getEmailSenderFromDB()
  if (sender.isMock) {
    return { error: "메일 발송 설정이 완료되지 않았습니다. 이메일 제공자를 설정하거나 환경변수를 확인하세요." }
  }
  const now = new Date().toISOString()
  let sent = 0
  let failed = 0

  for (const dist of distributions) {
    // 기존 큐에서 subject/body 가져오기
    const { data: prevQueue } = await supabase
      .from("email_queue")
      .select("subject, body_html")
      .eq("distribution_id", dist.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    let subject: string
    let bodyHtml: string

    if (prevQueue) {
      subject = prevQueue.subject
      bodyHtml = prevQueue.body_html
    } else {
      const { data: defaultTpl } = await supabase
        .from("email_templates")
        .select("subject, body_html")
        .eq("is_default", true)
        .limit(1)
        .single()

      if (!defaultTpl) continue

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"
      const vars = getTemplateVariables({
        recipientName: dist.recipient_name ?? undefined,
        surveyLink: `${baseUrl}/d/${dist.unique_token}`,
      })

      subject = renderTemplate(defaultTpl.subject, vars)
      bodyHtml = renderTemplate(defaultTpl.body_html, vars)
    }

    // 큐 insert + 즉시 발송
    const { data: queueItem } = await supabase
      .from("email_queue")
      .insert({
        distribution_id: dist.id,
        recipient_email: dist.recipient_email!,
        recipient_name: dist.recipient_name,
        subject,
        body_html: bodyHtml,
        schedule_type: "immediate",
        scheduled_at: now,
        status: "processing",
      })
      .select("id")
      .single()

    const result = await sender.send({
      to: dist.recipient_email!,
      toName: dist.recipient_name ?? undefined,
      subject,
      bodyHtml,
    })

    if (result.success) {
      if (queueItem) {
        await supabase.from("email_queue").update({ status: "sent", sent_at: now }).eq("id", queueItem.id)
      }
      await supabase.from("distributions").update({ status: "sent", sent_at: now }).eq("id", dist.id)
      sent++
    } else {
      if (queueItem) {
        await supabase.from("email_queue").update({ status: "failed", last_error: result.error ?? "Unknown" }).eq("id", queueItem.id)
      }
      failed++
    }
  }

  return { sent, failed }
}

// ─── 이메일 제공자 관리 ───

const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
}

export async function getEmailProviders() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('email_providers')
    .select('id, name, provider_type, smtp_host, smtp_port, smtp_user, from_name, from_email, is_default, created_at')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function saveEmailProvider(input: {
  id?: string
  name: string
  providerType: EmailProviderType
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string
  apiToken?: string
  apiUserId?: string
  fromName?: string
  fromEmail?: string
  isDefault?: boolean
}): Promise<{ id?: string; error?: string }> {
  const supabase = createAdminClient()

  const preset = SMTP_PRESETS[input.providerType]

  const record = {
    name: input.name,
    provider_type: input.providerType,
    smtp_host: input.smtpHost || preset?.host || null,
    smtp_port: input.smtpPort || preset?.port || 587,
    smtp_secure: input.smtpSecure ?? preset?.secure ?? false,
    smtp_user: input.smtpUser || null,
    smtp_password: input.smtpPassword || null,
    api_token: input.apiToken || null,
    api_user_id: input.apiUserId || null,
    from_name: input.fromName || null,
    from_email: input.fromEmail || null,
    is_default: input.isDefault ?? false,
    updated_at: new Date().toISOString(),
  }

  // is_default 설정 시 기존 기본값 해제
  if (record.is_default) {
    await supabase
      .from('email_providers')
      .update({ is_default: false })
      .eq('is_default', true)
  }

  if (input.id) {
    const { error } = await supabase
      .from('email_providers')
      .update(record)
      .eq('id', input.id)

    if (error) return { error: '제공자 수정 실패: ' + error.message }
    return { id: input.id }
  }

  const { data, error } = await supabase
    .from('email_providers')
    .insert(record)
    .select('id')
    .single()

  if (error || !data) return { error: '제공자 등록 실패: ' + (error?.message ?? '') }
  return { id: data.id }
}

export async function deleteEmailProvider(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('email_providers')
    .delete()
    .eq('id', id)

  if (error) return { error: '삭제 실패: ' + error.message }
  return {}
}

export async function testEmailProvider(input: {
  providerType: EmailProviderType
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string
  apiToken?: string
  apiUserId?: string
  fromName?: string
  fromEmail?: string
  testEmail: string
}): Promise<{ success?: boolean; error?: string }> {
  const config: EmailProviderConfig = {
    id: '',
    name: '',
    provider_type: input.providerType,
    smtp_host: input.smtpHost || null,
    smtp_port: input.smtpPort || null,
    smtp_secure: input.smtpSecure ?? null,
    smtp_user: input.smtpUser || null,
    smtp_password: input.smtpPassword || null,
    api_token: input.apiToken || null,
    api_user_id: input.apiUserId || null,
    from_name: input.fromName || null,
    from_email: input.fromEmail || null,
    is_default: false,
    created_by: null,
    created_at: '',
    updated_at: '',
  }

  const sender = createSenderFromConfig(config)
  if (sender.isMock) {
    return { error: '발송 설정이 올바르지 않습니다. 필수 항목을 확인하세요.' }
  }

  const result = await sender.send({
    to: input.testEmail,
    toName: '테스트 수신자',
    subject: '[테스트] 이메일 제공자 연결 확인',
    bodyHtml: '<p>이 메일은 이메일 제공자 설정 테스트입니다.</p><p>정상적으로 수신되었다면 설정이 올바릅니다.</p>',
  })

  if (result.success) return { success: true }
  return { error: result.error ?? '발송 실패' }
}

// ═══════════════════════════════════════════════
// SMS 문자 메시지 배부
// ═══════════════════════════════════════════════

// ─── SMS 템플릿 목록 ───

export async function getSmsTemplates() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("sms_templates")
    .select("id, name, body_text, message_type, is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  return (data ?? []) as {
    id: string
    name: string
    body_text: string
    message_type: string
    is_default: boolean
  }[]
}

// ─── SMS 발송 큐 등록 ───

interface ScheduleSmsInput {
  batchId: string
  templateId: string
  scheduleType: "immediate" | "scheduled" | "trigger"
  scheduledAt?: string
  triggerRule?: { type: string; days: number }
  customBodyText?: string
}

export async function scheduleSmsBatch(
  input: ScheduleSmsInput
): Promise<{ queued?: number; error?: string }> {
  const supabase = createAdminClient()

  // 1. 템플릿 조회
  const { data: template, error: tplErr } = await supabase
    .from("sms_templates")
    .select("id, body_text")
    .eq("id", input.templateId)
    .single()

  if (tplErr || !template) {
    return { error: "SMS 템플릿을 찾을 수 없습니다" }
  }

  // 2. 배치의 distributions 조회 (전화번호 있는 건만)
  const { data: distributions, error: distErr } = await supabase
    .from("distributions")
    .select(`
      id, unique_token, recipient_name, recipient_phone,
      edu_surveys ( id, title,
        sessions ( name,
          courses ( name,
            projects ( name, customers ( company_name ) )
          )
        )
      )
    `)
    .eq("batch_id", input.batchId)
    .not("recipient_phone", "is", null)

  if (distErr || !distributions || distributions.length === 0) {
    return { error: "SMS 발송 가능한 수신자가 없습니다 (전화번호 필요)" }
  }

  // 3. 각 distribution별로 변수 맵 생성 → 렌더링 → 큐 적재
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"

  const queueInserts = distributions.map((d) => {
    const survey = d.edu_surveys as any
    const session = survey?.sessions as any
    const course = session?.courses as any
    const project = course?.projects as any
    const companyName = project?.customers?.company_name ?? ""

    const vars = getSmsTemplateVariables({
      recipientName: d.recipient_name ?? undefined,
      companyName,
      courseName: course?.name ?? survey?.title ?? "",
      surveyLink: `${baseUrl}/d/${d.unique_token}`,
    })

    const bodyText = renderSmsTemplate(input.customBodyText ?? template.body_text, vars)
    const messageType = getSmsMessageType(bodyText)

    return {
      distribution_id: d.id,
      template_id: template.id,
      recipient_phone: d.recipient_phone!,
      recipient_name: d.recipient_name ?? null,
      body_text: bodyText,
      message_type: messageType,
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

  const { error: insertErr } = await supabase
    .from("sms_queue")
    .insert(queueInserts)

  if (insertErr) {
    return { error: "SMS 큐 등록 실패: " + insertErr.message }
  }

  // 4. 즉시 발송인 경우 바로 처리
  if (input.scheduleType === "immediate") {
    const sender = await getSmsSenderFromDB()
    if (sender.isMock) {
      return { error: "SMS 발송 설정이 완료되지 않았습니다. SMS 제공자를 설정하거나 환경변수를 확인하세요." }
    }

    const { data: pendingQueue } = await supabase
      .from("sms_queue")
      .select("id, recipient_phone, recipient_name, body_text, message_type, distribution_id")
      .eq("status", "pending")
      .in("distribution_id", distributions.map((d) => d.id))

    const now = new Date().toISOString()

    for (const item of pendingQueue ?? []) {
      await supabase
        .from("sms_queue")
        .update({ status: "processing" })
        .eq("id", item.id)

      const result = await sender.send({
        to: item.recipient_phone,
        toName: item.recipient_name ?? undefined,
        body: item.body_text,
        messageType: item.message_type as "SMS" | "LMS",
      })

      if (result.success) {
        await supabase
          .from("sms_queue")
          .update({ status: "sent", sent_at: now, provider_message_id: result.messageId ?? null, provider_message_key: result.messageKey ?? null })
          .eq("id", item.id)

        await supabase
          .from("distributions")
          .update({ status: "sent", sent_at: now })
          .eq("id", item.distribution_id)
      } else {
        await supabase
          .from("sms_queue")
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

// ─── 테스트 SMS 발송 (큐 미사용, 직접 발송) ───

export async function sendTestSms(input: {
  templateId: string
  testPhone: string
  customBodyText?: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { data: template, error: tplErr } = await supabase
    .from("sms_templates")
    .select("id, body_text")
    .eq("id", input.templateId)
    .single()

  if (tplErr || !template) {
    return { error: "SMS 템플릿을 찾을 수 없습니다" }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"
  const vars = getSmsTemplateVariables({
    recipientName: "홍길동",
    companyName: "(주)엑셀루트",
    courseName: "리더십 스킬 향상 과정",
    surveyLink: `${baseUrl}/d/test-preview`,
  })

  const bodyText = `[테스트] ${renderSmsTemplate(input.customBodyText ?? template.body_text, vars)}`
  const messageType = getSmsMessageType(bodyText)

  const sender = await getSmsSenderFromDB()
  if (sender.isMock) {
    return { error: "SMS 발송 설정이 완료되지 않았습니다. SMS 제공자를 설정하거나 환경변수를 확인하세요." }
  }

  const result = await sender.send({
    to: input.testPhone,
    toName: "테스트 수신자",
    body: bodyText,
    messageType,
  })

  if (result.success) return { success: true }
  return { error: result.error ?? "SMS 발송 실패" }
}

// ─── SMS 개별 재발송 ───

export async function resendDistributionSms(
  distributionId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { data: dist, error: distErr } = await supabase
    .from("distributions")
    .select("id, unique_token, recipient_name, recipient_phone, status")
    .eq("id", distributionId)
    .single()

  if (distErr || !dist) {
    return { error: "배부 데이터를 찾을 수 없습니다" }
  }
  if (!dist.recipient_phone) {
    return { error: "수신자 전화번호가 없습니다" }
  }
  if (dist.status === "completed") {
    return { error: "이미 설문을 완료한 수신자입니다" }
  }

  // 기존 sms_queue에서 body 가져오기
  const { data: prevQueue } = await supabase
    .from("sms_queue")
    .select("body_text, message_type")
    .eq("distribution_id", distributionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  let bodyText: string
  let messageType: "SMS" | "LMS"

  if (prevQueue) {
    bodyText = prevQueue.body_text
    messageType = prevQueue.message_type as "SMS" | "LMS"
  } else {
    const { data: defaultTpl } = await supabase
      .from("sms_templates")
      .select("body_text")
      .eq("is_default", true)
      .limit(1)
      .single()

    if (!defaultTpl) {
      return { error: "기본 SMS 템플릿을 찾을 수 없습니다" }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"
    const vars = getSmsTemplateVariables({
      recipientName: dist.recipient_name ?? undefined,
      surveyLink: `${baseUrl}/d/${dist.unique_token}`,
    })

    bodyText = renderSmsTemplate(defaultTpl.body_text, vars)
    messageType = getSmsMessageType(bodyText)
  }

  const now = new Date().toISOString()
  const { data: queueItem } = await supabase
    .from("sms_queue")
    .insert({
      distribution_id: dist.id,
      recipient_phone: dist.recipient_phone,
      recipient_name: dist.recipient_name,
      body_text: bodyText,
      message_type: messageType,
      schedule_type: "immediate",
      scheduled_at: now,
      status: "processing",
    })
    .select("id")
    .single()

  const sender = await getSmsSenderFromDB()
  if (sender.isMock) {
    return { error: "SMS 발송 설정이 완료되지 않았습니다." }
  }

  const result = await sender.send({
    to: dist.recipient_phone,
    toName: dist.recipient_name ?? undefined,
    body: bodyText,
    messageType,
  })

  if (result.success) {
    if (queueItem) {
      await supabase.from("sms_queue").update({ status: "sent", sent_at: now }).eq("id", queueItem.id)
    }
    await supabase.from("distributions").update({ status: "sent", sent_at: now }).eq("id", dist.id)
    return { success: true }
  }

  if (queueItem) {
    await supabase.from("sms_queue").update({ status: "failed", last_error: result.error ?? "Unknown" }).eq("id", queueItem.id)
  }
  return { error: result.error ?? "SMS 발송 실패" }
}

// ─── SMS 배치 미응답자 일괄 재발송 ───

export async function resendBatchSms(
  batchId: string
): Promise<{ sent?: number; failed?: number; error?: string }> {
  const supabase = createAdminClient()

  const { data: distributions, error: distErr } = await supabase
    .from("distributions")
    .select("id, unique_token, recipient_name, recipient_phone, status")
    .eq("batch_id", batchId)
    .neq("status", "completed")
    .not("recipient_phone", "is", null)

  if (distErr || !distributions || distributions.length === 0) {
    return { error: "SMS 재발송 대상이 없습니다" }
  }

  const sender = await getSmsSenderFromDB()
  if (sender.isMock) {
    return { error: "SMS 발송 설정이 완료되지 않았습니다." }
  }

  const now = new Date().toISOString()
  let sent = 0
  let failed = 0

  for (const dist of distributions) {
    const { data: prevQueue } = await supabase
      .from("sms_queue")
      .select("body_text, message_type")
      .eq("distribution_id", dist.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    let bodyText: string
    let messageType: "SMS" | "LMS"

    if (prevQueue) {
      bodyText = prevQueue.body_text
      messageType = prevQueue.message_type as "SMS" | "LMS"
    } else {
      const { data: defaultTpl } = await supabase
        .from("sms_templates")
        .select("body_text")
        .eq("is_default", true)
        .limit(1)
        .single()

      if (!defaultTpl) continue

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"
      const vars = getSmsTemplateVariables({
        recipientName: dist.recipient_name ?? undefined,
        surveyLink: `${baseUrl}/d/${dist.unique_token}`,
      })

      bodyText = renderSmsTemplate(defaultTpl.body_text, vars)
      messageType = getSmsMessageType(bodyText)
    }

    const { data: queueItem } = await supabase
      .from("sms_queue")
      .insert({
        distribution_id: dist.id,
        recipient_phone: dist.recipient_phone!,
        recipient_name: dist.recipient_name,
        body_text: bodyText,
        message_type: messageType,
        schedule_type: "immediate",
        scheduled_at: now,
        status: "processing",
      })
      .select("id")
      .single()

    const result = await sender.send({
      to: dist.recipient_phone!,
      toName: dist.recipient_name ?? undefined,
      body: bodyText,
      messageType,
    })

    if (result.success) {
      if (queueItem) {
        await supabase.from("sms_queue").update({ status: "sent", sent_at: now }).eq("id", queueItem.id)
      }
      await supabase.from("distributions").update({ status: "sent", sent_at: now }).eq("id", dist.id)
      sent++
    } else {
      if (queueItem) {
        await supabase.from("sms_queue").update({ status: "failed", last_error: result.error ?? "Unknown" }).eq("id", queueItem.id)
      }
      failed++
    }
  }

  return { sent, failed }
}

// ─── SMS 프로바이더 관리 ───

export async function getSmsProviders() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("sms_providers")
    .select("id, name, provider_type, sender_phone, is_default, created_at")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  return data ?? []
}

export async function saveSmsProvider(input: {
  id?: string
  name: string
  providerType: SmsProviderType
  apiKey?: string
  apiUserId?: string
  senderPhone?: string
  isDefault?: boolean
}): Promise<{ id?: string; error?: string }> {
  const supabase = createAdminClient()

  const record = {
    name: input.name,
    provider_type: input.providerType,
    api_key: input.apiKey || null,
    api_user_id: input.apiUserId || null,
    sender_phone: input.senderPhone || null,
    is_default: input.isDefault ?? false,
    updated_at: new Date().toISOString(),
  }

  if (record.is_default) {
    await supabase
      .from("sms_providers")
      .update({ is_default: false })
      .eq("is_default", true)
  }

  if (input.id) {
    const { error } = await supabase
      .from("sms_providers")
      .update(record)
      .eq("id", input.id)

    if (error) return { error: "SMS 제공자 수정 실패: " + error.message }
    return { id: input.id }
  }

  const { data, error } = await supabase
    .from("sms_providers")
    .insert(record)
    .select("id")
    .single()

  if (error || !data) return { error: "SMS 제공자 등록 실패: " + (error?.message ?? "") }
  return { id: data.id }
}

export async function deleteSmsProvider(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("sms_providers")
    .delete()
    .eq("id", id)

  if (error) return { error: "삭제 실패: " + error.message }
  return {}
}

export async function testSmsProvider(input: {
  providerType: SmsProviderType
  apiKey?: string
  apiUserId?: string
  senderPhone?: string
  testPhone: string
}): Promise<{ success?: boolean; error?: string }> {
  const config: SmsProviderConfig = {
    id: "",
    name: "",
    provider_type: input.providerType,
    api_key: input.apiKey || null,
    api_user_id: input.apiUserId || null,
    sender_phone: input.senderPhone || null,
    is_default: false,
    created_by: null,
    created_at: "",
    updated_at: "",
  }

  const sender = createSmsFromConfig(config)
  if (sender.isMock) {
    return { error: "SMS 설정이 올바르지 않습니다. 필수 항목을 확인하세요." }
  }

  const result = await sender.send({
    to: input.testPhone,
    toName: "테스트 수신자",
    body: "[테스트] SMS 제공자 연결 확인 메시지입니다.",
    messageType: "SMS",
  })

  if (result.success) return { success: true }
  return { error: result.error ?? "SMS 발송 실패" }
}

// ─── SMS 예약 발송 취소 ───

export async function cancelScheduledSms(
  queueId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient()

  // 1. 큐 항목 조회
  const { data: item, error: qErr } = await supabase
    .from("sms_queue")
    .select("id, status, provider_message_key, schedule_type, distribution_id")
    .eq("id", queueId)
    .single()

  if (qErr || !item) {
    return { error: "SMS 큐 항목을 찾을 수 없습니다" }
  }

  if (item.status !== "pending") {
    return { error: `취소 불가: 현재 상태가 '${item.status}'입니다 (pending만 취소 가능)` }
  }

  // 2. 뿌리오 예약 발송인 경우 API로 취소 요청
  if (item.provider_message_key) {
    const sender = await getSmsSenderFromDB()
    if (sender.cancel) {
      const providerConfig = await supabase
        .from("sms_providers")
        .select("api_user_id")
        .eq("is_default", true)
        .limit(1)
        .single()

      const account = providerConfig.data?.api_user_id || process.env.PPURIO_USERNAME || ""
      const result = await sender.cancel(account, item.provider_message_key)

      if (!result.success) {
        return { error: result.error ?? "뿌리오 예약 취소 실패" }
      }
    }
  }

  // 3. 큐 상태 업데이트
  const { error: updateErr } = await supabase
    .from("sms_queue")
    .update({ status: "cancelled" })
    .eq("id", item.id)

  if (updateErr) {
    return { error: "큐 상태 업데이트 실패: " + updateErr.message }
  }

  return { success: true }
}

// ─── SMS 배치 예약 일괄 취소 ───

export async function cancelScheduledSmsBatch(
  batchId: string
): Promise<{ cancelled?: number; error?: string }> {
  const supabase = createAdminClient()

  const { data: distributions } = await supabase
    .from("distributions")
    .select("id")
    .eq("batch_id", batchId)

  if (!distributions || distributions.length === 0) {
    return { error: "배치에 해당하는 배부 데이터가 없습니다" }
  }

  const distIds = distributions.map((d) => d.id)

  const { data: pendingItems } = await supabase
    .from("sms_queue")
    .select("id")
    .in("distribution_id", distIds)
    .eq("status", "pending")

  if (!pendingItems || pendingItems.length === 0) {
    return { error: "취소 가능한 대기 중 SMS가 없습니다" }
  }

  const { error: updateErr } = await supabase
    .from("sms_queue")
    .update({ status: "cancelled" })
    .in("id", pendingItems.map((i) => i.id))

  if (updateErr) {
    return { error: "일괄 취소 실패: " + updateErr.message }
  }

  return { cancelled: pendingItems.length }
}
