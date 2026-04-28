/**
 * GET /api/cron/dispatch-alerts
 *
 * L1 자동화의 E1 (PR-Auto-5):
 *  - cs_dispatch_alerts.status='pending' 행을 운영자 이메일로 발송.
 *  - 매일 KST 11:00 (UTC 02:00) Vercel cron 이 호출 — auto-dispatch
 *    cron(KST 10:00) 직후 1시간 텀으로 실패/한도/생성 알림을 묶어 발송.
 *  - 수신자: cs_automation_settings.alert_email (없으면 발송 스킵).
 *  - 발송 성공/실패 여부를 cs_dispatch_alerts.status 와 sent_at/failed_reason
 *    에 기록. 재시도는 별도 (현재 1회 시도).
 *
 * 토대: PR-Auto-1 (cs_dispatch_alerts), 기존 lib/email/sender (HiWorks/SMTP).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailSenderFromDB } from "@/lib/email/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 50;

interface AlertRow {
  id: string;
  severity: "info" | "warn" | "error";
  source: string;
  subject: string;
  body: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  // 1. CRON_SECRET 검증
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = createAdminClient();

  // 2. 글로벌 설정 — alert_email
  const { data: settings, error: settingsErr } = await supa
    .from("cs_automation_settings")
    .select("alert_email")
    .eq("id", "global")
    .single();

  if (settingsErr || !settings) {
    return NextResponse.json(
      { error: "settings_not_found", detail: settingsErr?.message },
      { status: 500 }
    );
  }

  if (!settings.alert_email) {
    return NextResponse.json({
      status: "skipped",
      reason: "alert_email_not_configured",
      hint: "UPDATE cs_automation_settings SET alert_email='운영자@...' WHERE id='global'",
    });
  }

  // 3. pending alert 조회
  const { data: alerts, error: alertsErr } = await supa
    .from("cs_dispatch_alerts")
    .select("id, severity, source, subject, body, context, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (alertsErr) {
    return NextResponse.json(
      { error: "alerts_query_failed", detail: alertsErr.message },
      { status: 500 }
    );
  }

  if (!alerts || alerts.length === 0) {
    return NextResponse.json({ status: "ok", processed: 0, sent: 0, failed: 0 });
  }

  // 4. 발송기 준비 (DB 기본 제공자, 없으면 mock)
  const sender = await getEmailSenderFromDB();
  if (sender.isMock) {
    return NextResponse.json(
      {
        status: "skipped",
        reason: "email_sender_mock",
        hint: "email_providers 테이블에 is_default=true 행 또는 HIWORKS_OFFICE_TOKEN/USER_ID env 설정 필요.",
        pending_count: alerts.length,
      },
      { status: 503 }
    );
  }

  // 5. 순회 발송
  let sent = 0;
  let failed = 0;
  const failures: { id: string; error: string }[] = [];

  for (const a of alerts as AlertRow[]) {
    // 5.1 lock — pending → processing 의 의미로 sent 미정 상태 마킹은 status 컬럼에
    //      별도 'processing' 값이 없어 그냥 진행. 동시 cron 호출 가능성 낮음 (Vercel 단일 cron).
    const subject = formatSubject(a);
    const bodyHtml = formatBody(a);

    let result;
    try {
      result = await sender.send({
        to: settings.alert_email,
        subject,
        bodyHtml,
      });
    } catch (exc) {
      result = { success: false, error: String(exc) };
    }

    if (result.success) {
      await supa
        .from("cs_dispatch_alerts")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", a.id);
      sent++;
    } else {
      await supa
        .from("cs_dispatch_alerts")
        .update({ status: "failed", failed_reason: result.error ?? "send_failed" })
        .eq("id", a.id);
      failed++;
      failures.push({ id: a.id, error: result.error ?? "unknown" });
    }
  }

  return NextResponse.json({
    status: "ok",
    processed: alerts.length,
    sent,
    failed,
    failures: failures.length > 0 ? failures.slice(0, 5) : undefined,
  });
}

// ──────────────────────────────────────────────────────────────
// 포맷팅
// ──────────────────────────────────────────────────────────────

function formatSubject(a: AlertRow): string {
  const tag =
    a.severity === "error" ? "[ERROR]" : a.severity === "warn" ? "[WARN]" : "[INFO]";
  return `${tag} CS 자동화 / ${a.source} — ${a.subject}`;
}

function formatBody(a: AlertRow): string {
  const ts = new Date(a.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const ctxBlock = a.context
    ? `<pre style="background:#f6f8fa;padding:12px;border-radius:6px;font-size:13px;overflow-x:auto">${escapeHtml(
        JSON.stringify(a.context, null, 2)
      )}</pre>`
    : "";
  const bodyBlock = a.body
    ? `<p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(a.body)}</p>`
    : "";
  const sevColor =
    a.severity === "error" ? "#dc2626" : a.severity === "warn" ? "#d97706" : "#2563eb";

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:720px;margin:0 auto;padding:24px">
  <div style="border-left:4px solid ${sevColor};padding-left:16px;margin-bottom:24px">
    <div style="font-size:14px;color:#6b7280;margin-bottom:4px">${escapeHtml(a.source)} · ${escapeHtml(ts)} KST</div>
    <h2 style="margin:0;font-size:20px;color:${sevColor}">${escapeHtml(a.subject)}</h2>
  </div>
  ${bodyBlock}
  ${ctxBlock}
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="font-size:12px;color:#9ca3af">cs_dispatch_alerts.id = ${a.id}<br>
  본 메일은 cs_automation_settings.alert_email 로 자동 발송됩니다. 수신을 멈추려면 alert_email 컬럼을 비우세요.</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
