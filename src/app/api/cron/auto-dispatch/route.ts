/**
 * GET /api/cron/auto-dispatch
 *
 * L1 자동화의 D1c+D2+D3 (PR-Auto-4):
 *  - 매일 KST 10:00 (UTC 01:00) Vercel cron 이 본 라우트를 호출.
 *  - cs_automation_settings.auto_dispatch_enabled (전역 kill switch)
 *    + cs_target_batches.auto_dispatch_mode (per-batch, off/dry_run/on)
 *    조합으로 발송 대상 결정.
 *  - daily_send_limit (default 100) 초과 시 즉시 정지 + 운영자 알림.
 *  - dry_run 모드는 후보 미리보기만 기록, 실제 발송 X.
 *  - on 모드는 cs-bridge POST (기존 발송 단일 진실원) 호출.
 *
 * 토대: PR-Auto-1 (cs_automation_settings, cs_dispatch_attempts, cs_dispatch_alerts)
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BatchRow {
  id: string;
  batch_name: string | null;
  survey_id: string | null;
  auto_dispatch_mode: "off" | "dry_run" | "on";
}

interface TargetRow {
  id: string;
  contact_id: string | null;
  course_id: string | null;
  project_id: string | null;
  cs_contacts: {
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    department: string | null;
    position: string | null;
  } | null;
}

interface AttemptStats {
  candidates: number;
  dispatched: number;
  skipped: number;
  errors: number;
  reason: string;
  responsePayload?: unknown;
}

export async function GET(req: NextRequest) {
  // 1. CRON_SECRET 검증 (Vercel cron header)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = createAdminClient();

  // 2. 글로벌 설정 로드
  const { data: settings, error: settingsErr } = await supa
    .from("cs_automation_settings")
    .select("*")
    .eq("id", "global")
    .single();

  if (settingsErr || !settings) {
    return NextResponse.json(
      { error: "settings_not_found", detail: settingsErr?.message },
      { status: 500 }
    );
  }

  // 3. 전역 kill switch 확인
  if (!settings.auto_dispatch_enabled) {
    await logAttempt(supa, {
      batchId: null,
      mode: "on",
      stats: { candidates: 0, dispatched: 0, skipped: 0, errors: 0, reason: "flag_off" },
      dailyBefore: 0,
      dailyAfter: 0,
      dailyLimit: settings.daily_send_limit,
    });
    return NextResponse.json({
      status: "skipped",
      reason: "auto_dispatch_enabled=false",
      summary: { batches: 0, dispatched: 0, dry_run: 0, errors: 0 },
    });
  }

  // 4. 오늘 누적 + 잔여 한도
  const { data: todayCount } = await supa.rpc("fn_cs_automation_count_today_sends");
  let dailyTotal = (typeof todayCount === "number" ? todayCount : 0) ?? 0;
  let dailyRemaining = Math.max(0, settings.daily_send_limit - dailyTotal);

  // 5. 자동 dispatch 대상 batch 조회 (mode in [on, dry_run], survey_id 있음)
  const { data: batches, error: batchesErr } = await supa
    .from("cs_target_batches")
    .select("id, batch_name, survey_id, auto_dispatch_mode")
    .in("auto_dispatch_mode", ["on", "dry_run"])
    .not("survey_id", "is", null);

  if (batchesErr) {
    return NextResponse.json(
      { error: "batches_query_failed", detail: batchesErr.message },
      { status: 500 }
    );
  }

  const summary = {
    batches: batches?.length ?? 0,
    dry_run_attempts: 0,
    dispatched: 0,
    skipped: 0,
    errors: 0,
    limit_exceeded_batches: 0,
  };

  // 6. batch 별 처리
  for (const batch of (batches ?? []) as BatchRow[]) {
    // 6.1 후보 조회 — step5_confirmed=true & is_eligible=true & distribution_id is null
    const { data: targets, error: tErr } = await supa
      .from("cs_survey_targets")
      .select(
        "id, contact_id, course_id, project_id, cs_contacts(contact_name, email, phone, mobile, department, position)"
      )
      .eq("batch_id", batch.id)
      .eq("step5_confirmed", true)
      .eq("is_eligible", true)
      .is("distribution_id", null);

    if (tErr) {
      await logAttempt(supa, {
        batchId: batch.id,
        mode: batch.auto_dispatch_mode === "dry_run" ? "dry_run" : "on",
        stats: { candidates: 0, dispatched: 0, skipped: 0, errors: 1, reason: "error", responsePayload: { error: tErr.message } },
        dailyBefore: dailyTotal,
        dailyAfter: dailyTotal,
        dailyLimit: settings.daily_send_limit,
      });
      summary.errors++;
      continue;
    }

    const targetRows = (targets ?? []) as unknown as TargetRow[];
    const candidates = targetRows.length;

    // 6.2 후보 0건
    if (candidates === 0) {
      await logAttempt(supa, {
        batchId: batch.id,
        mode: batch.auto_dispatch_mode === "dry_run" ? "dry_run" : "on",
        stats: { candidates: 0, dispatched: 0, skipped: 0, errors: 0, reason: "no_candidates" },
        dailyBefore: dailyTotal,
        dailyAfter: dailyTotal,
        dailyLimit: settings.daily_send_limit,
      });
      continue;
    }

    // 6.3 dry_run — 미리보기 5건만 stash, 실제 발송 X
    if (batch.auto_dispatch_mode === "dry_run") {
      const preview = targetRows.slice(0, 5).map((t) => ({
        targetId: t.id,
        name: t.cs_contacts?.contact_name ?? null,
        email: t.cs_contacts?.email ?? null,
        phone: t.cs_contacts?.mobile ?? t.cs_contacts?.phone ?? null,
      }));
      await logAttempt(supa, {
        batchId: batch.id,
        mode: "dry_run",
        stats: {
          candidates,
          dispatched: 0,
          skipped: 0,
          errors: 0,
          reason: "success",
          responsePayload: { preview, would_send: candidates },
        },
        dailyBefore: dailyTotal,
        dailyAfter: dailyTotal,
        dailyLimit: settings.daily_send_limit,
      });
      summary.dry_run_attempts++;
      continue;
    }

    // 6.4 on — 한도 검사 + cs-bridge 호출
    if (dailyRemaining <= 0) {
      await logAttempt(supa, {
        batchId: batch.id,
        mode: "on",
        stats: { candidates, dispatched: 0, skipped: candidates, errors: 0, reason: "limit_exceeded" },
        dailyBefore: dailyTotal,
        dailyAfter: dailyTotal,
        dailyLimit: settings.daily_send_limit,
      });
      await supa.rpc("fn_cs_automation_enqueue_alert", {
        p_severity: "warn",
        p_source: "auto_dispatch",
        p_subject: `daily_send_limit ${settings.daily_send_limit}건 도달 — batch ${batch.batch_name ?? batch.id} 대기`,
        p_body: `해당 batch 의 ${candidates}건은 다음 일자까지 대기. limit 늘리거나 다음 cron 호출에 재시도됨.`,
        p_context: { batch_id: batch.id, batch_name: batch.batch_name, candidates },
      });
      summary.limit_exceeded_batches++;
      summary.skipped += candidates;
      continue;
    }

    // 한도 내 슬라이스
    const willSendCount = Math.min(candidates, dailyRemaining);
    const sliced = targetRows.slice(0, willSendCount);
    const partial = willSendCount < candidates;

    // cs-bridge payload 조립
    const payload = {
      batchId: batch.id,
      channel: "auto" as const,
      targets: sliced.map((t) => ({
        targetId: t.id,
        contactId: t.contact_id,
        name: t.cs_contacts?.contact_name ?? null,
        email: t.cs_contacts?.email ?? null,
        phone: t.cs_contacts?.mobile ?? t.cs_contacts?.phone ?? null,
        department: t.cs_contacts?.department ?? null,
        position: t.cs_contacts?.position ?? null,
        courseId: t.course_id,
        projectId: t.project_id,
      })),
    };

    const bridgeUrl = resolveBridgeUrl(req);
    const bridgeKey = process.env.CS_BRIDGE_API_KEY;
    if (!bridgeKey) {
      await logAttempt(supa, {
        batchId: batch.id,
        mode: "on",
        stats: { candidates, dispatched: 0, skipped: 0, errors: candidates, reason: "error", responsePayload: { error: "CS_BRIDGE_API_KEY not configured" } },
        dailyBefore: dailyTotal,
        dailyAfter: dailyTotal,
        dailyLimit: settings.daily_send_limit,
      });
      await supa.rpc("fn_cs_automation_enqueue_alert", {
        p_severity: "error",
        p_source: "auto_dispatch",
        p_subject: "CS_BRIDGE_API_KEY env 누락 — 자동 dispatch 중단",
        p_body: "Vercel 환경변수에 CS_BRIDGE_API_KEY 설정 필요.",
        p_context: { batch_id: batch.id },
      });
      summary.errors += candidates;
      continue;
    }

    let bridgeResp: unknown = null;
    let dispatched = 0;
    let skipped = 0;
    let errors = 0;
    let reason: AttemptStats["reason"] = "success";

    try {
      const res = await fetch(bridgeUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cs-bridge-key": bridgeKey,
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      bridgeResp = json;
      if (!res.ok) {
        reason = "error";
        errors = candidates;
      } else {
        dispatched = (json.dispatched as number) ?? 0;
        skipped = (json.skipped as number) ?? 0;
        errors = (json.errors as number) ?? 0;
        if (errors > 0 && dispatched === 0) reason = "error";
        else if (errors > 0) reason = "partial";
      }
    } catch (exc) {
      reason = "error";
      errors = candidates;
      bridgeResp = { error: String(exc) };
    }

    const dailyAfter = dailyTotal + dispatched;
    await logAttempt(supa, {
      batchId: batch.id,
      mode: "on",
      stats: {
        candidates,
        dispatched,
        skipped,
        errors,
        reason,
        responsePayload: { bridge: bridgeResp, partial, willSendCount },
      },
      dailyBefore: dailyTotal,
      dailyAfter,
      dailyLimit: settings.daily_send_limit,
    });

    if (partial) {
      await supa.rpc("fn_cs_automation_enqueue_alert", {
        p_severity: "warn",
        p_source: "auto_dispatch",
        p_subject: `daily_send_limit 도달 — batch ${batch.batch_name ?? batch.id} 부분 발송 (${dispatched}/${candidates})`,
        p_body: "남은 후보는 다음 cron 호출에 처리됨.",
        p_context: { batch_id: batch.id, dispatched, remaining: candidates - dispatched },
      });
    }
    if (reason === "error") {
      await supa.rpc("fn_cs_automation_enqueue_alert", {
        p_severity: "error",
        p_source: "auto_dispatch",
        p_subject: `자동 dispatch 실패 — batch ${batch.batch_name ?? batch.id}`,
        p_body: typeof bridgeResp === "string" ? bridgeResp : JSON.stringify(bridgeResp),
        p_context: { batch_id: batch.id, candidates, errors },
      });
    }

    summary.dispatched += dispatched;
    summary.skipped += skipped;
    summary.errors += errors;
    dailyTotal = dailyAfter;
    dailyRemaining = Math.max(0, settings.daily_send_limit - dailyTotal);
  }

  return NextResponse.json({
    status: "ok",
    summary,
    daily_total_after: dailyTotal,
    daily_remaining: dailyRemaining,
  });
}

// ──────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────

function resolveBridgeUrl(req: NextRequest): string {
  // Vercel 같은 도메인이라 절대 URL. 프로덕션에선 NEXT_PUBLIC_APP_URL 우선
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (base) return `${base}/api/distributions/cs-bridge`;
  // fallback: req origin
  const url = new URL(req.url);
  return `${url.origin}/api/distributions/cs-bridge`;
}

async function logAttempt(
  supa: ReturnType<typeof createAdminClient>,
  args: {
    batchId: string | null;
    mode: "dry_run" | "on";
    stats: AttemptStats;
    dailyBefore: number;
    dailyAfter: number;
    dailyLimit: number;
  }
): Promise<void> {
  await supa.rpc("fn_cs_automation_log_attempt", {
    p_batch_id: args.batchId,
    p_mode: args.mode,
    p_candidates: args.stats.candidates,
    p_dispatched: args.stats.dispatched,
    p_skipped: args.stats.skipped,
    p_errors: args.stats.errors,
    p_daily_before: args.dailyBefore,
    p_daily_after: args.dailyAfter,
    p_daily_limit: args.dailyLimit,
    p_reason: args.stats.reason,
    p_response: (args.stats.responsePayload ?? null) as object | null,
  });
}
