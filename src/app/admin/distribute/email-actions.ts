"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { renderTemplate, getTemplateVariables } from "@/lib/email/template-renderer"
import { getEmailSender, getEmailSenderFromDB, isEmailConfigured, createSenderFromConfig } from "@/lib/email/sender"
import type { EmailProviderType, EmailProviderConfig } from "@/lib/email/types"

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

  // N+1 제거: 기본 템플릿은 1회만 조회
  const { data: defaultTpl } = await supabase
    .from("email_templates")
    .select("subject, body_html")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle()

  // N+1 제거: 이전 큐 entry 도 distribution_id 단위로 일괄 조회 후 JS 에서 최신 1건씩 매핑
  const distIds = distributions.map((d) => d.id)
  const { data: prevQueueRows } = await supabase
    .from("email_queue")
    .select("distribution_id, subject, body_html, created_at")
    .in("distribution_id", distIds)
    .order("created_at", { ascending: false })

  const prevQueueByDist = new Map<string, { subject: string; body_html: string }>()
  for (const row of prevQueueRows ?? []) {
    if (!prevQueueByDist.has(row.distribution_id)) {
      prevQueueByDist.set(row.distribution_id, { subject: row.subject, body_html: row.body_html })
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"

  for (const dist of distributions) {
    let subject: string
    let bodyHtml: string

    const prev = prevQueueByDist.get(dist.id)
    if (prev) {
      subject = prev.subject
      bodyHtml = prev.body_html
    } else {
      if (!defaultTpl) continue

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
