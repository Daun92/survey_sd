"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getSmsSenderFromDB, createSmsFromConfig } from "@/lib/sms/sender"
import type { SmsProviderType, SmsProviderConfig } from "@/lib/sms/types"
import {
  renderTemplate as renderSmsTemplate,
  getTemplateVariables as getSmsTemplateVariables,
  getSmsMessageType,
} from "@/lib/sms/template-renderer"

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

  // N+1 제거: 기본 SMS 템플릿은 1회만 조회
  const { data: defaultTpl } = await supabase
    .from("sms_templates")
    .select("body_text")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle()

  // N+1 제거: 이전 큐 entry 도 distribution_id 단위로 일괄 조회 후 JS 에서 최신 1건씩 매핑
  const distIds = distributions.map((d) => d.id)
  const { data: prevQueueRows } = await supabase
    .from("sms_queue")
    .select("distribution_id, body_text, message_type, created_at")
    .in("distribution_id", distIds)
    .order("created_at", { ascending: false })

  const prevQueueByDist = new Map<string, { body_text: string; message_type: string }>()
  for (const row of prevQueueRows ?? []) {
    if (!prevQueueByDist.has(row.distribution_id)) {
      prevQueueByDist.set(row.distribution_id, { body_text: row.body_text, message_type: row.message_type })
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://survey.exc.co.kr"

  for (const dist of distributions) {
    let bodyText: string
    let messageType: "SMS" | "LMS"

    const prev = prevQueueByDist.get(dist.id)
    if (prev) {
      bodyText = prev.body_text
      messageType = prev.message_type as "SMS" | "LMS"
    } else {
      if (!defaultTpl) continue

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
