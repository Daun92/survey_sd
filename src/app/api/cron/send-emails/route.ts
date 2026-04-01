import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getEmailSender } from "@/lib/email/sender"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // CRON_SECRET 검증
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const sender = getEmailSender()

  if (sender.isMock) {
    console.error("[CRON] Email sender is in mock mode. Set HIWORKS_OFFICE_TOKEN and HIWORKS_USER_ID.")
    return NextResponse.json({ error: "Email not configured", processed: 0, succeeded: 0, failed: 0 }, { status: 503 })
  }

  const now = new Date().toISOString()

  let processed = 0
  let succeeded = 0
  let failed = 0

  // 1. pending + scheduled_at <= now 인 큐 항목 조회 (LIMIT 50)
  const { data: queue, error: qErr } = await supabase
    .from("email_queue")
    .select("id, distribution_id, recipient_email, recipient_name, subject, body_html, retry_count, max_retries")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50)

  if (qErr || !queue || queue.length === 0) {
    return NextResponse.json({ processed: 0, succeeded: 0, failed: 0 })
  }

  for (const item of queue) {
    processed++

    // 낙관적 잠금: processing으로 변경
    const { error: lockErr } = await supabase
      .from("email_queue")
      .update({ status: "processing" })
      .eq("id", item.id)
      .eq("status", "pending") // CAS 패턴

    if (lockErr) continue // 다른 프로세스가 이미 처리 중

    const result = await sender.send({
      to: item.recipient_email,
      toName: item.recipient_name ?? undefined,
      subject: item.subject,
      bodyHtml: item.body_html,
    })

    if (result.success) {
      succeeded++
      await supabase
        .from("email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", item.id)

      // distribution 상태 업데이트
      if (item.distribution_id) {
        await supabase
          .from("distributions")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.distribution_id)
      }
    } else {
      failed++
      const newRetry = (item.retry_count ?? 0) + 1
      const isFinal = newRetry >= (item.max_retries ?? 3)

      await supabase
        .from("email_queue")
        .update({
          status: isFinal ? "failed" : "pending",
          retry_count: newRetry,
          last_error: result.error ?? "Unknown error",
          // 재시도 시 5분 후 재시도
          ...(isFinal
            ? {}
            : {
                scheduled_at: new Date(
                  Date.now() + newRetry * 5 * 60 * 1000
                ).toISOString(),
              }),
        })
        .eq("id", item.id)
    }
  }

  return NextResponse.json({ processed, succeeded, failed })
}
