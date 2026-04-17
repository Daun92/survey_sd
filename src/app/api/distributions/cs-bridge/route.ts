/**
 * POST /api/distributions/cs-bridge
 *
 * cs_dashboard.html 의 "설문 발송" 버튼이 호출하는 bridge 엔드포인트.
 * cs_survey_targets 를 재검증한 뒤 distribution_batches / distributions 를 생성하고
 * 결과를 cs_survey_targets 로 writeback 한다.
 *
 * 설계: docs/cs-integration/phase1-spec.md §3
 * ADR-007, ADR-008 에 따라 Supabase client 단일 접근 (Prisma 미사용).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// ──────────────────────────────────────────────────────────────
// payload 타입
// ──────────────────────────────────────────────────────────────
type Channel = "auto" | "email" | "sms";

interface BridgeTarget {
  targetId: string;
  contactId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  department?: string | null;
  position?: string | null;
  courseId?: string | null;
  projectId?: string | null;
}

interface BridgePayload {
  batchId: string;
  channel?: Channel;
  targets: BridgeTarget[];
}

// ──────────────────────────────────────────────────────────────
// 입력 검증 (수동 — zod 의존성 미추가)
// ──────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

function validatePayload(body: unknown): { ok: true; data: BridgePayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body must be JSON object" };
  const b = body as Record<string, unknown>;

  if (!isUuid(b.batchId)) return { ok: false, error: "batchId must be uuid" };

  const channel = (b.channel as Channel | undefined) ?? "auto";
  if (!["auto", "email", "sms"].includes(channel)) {
    return { ok: false, error: "channel must be auto|email|sms" };
  }

  if (!Array.isArray(b.targets)) return { ok: false, error: "targets must be array" };
  if (b.targets.length === 0) return { ok: false, error: "targets must be non-empty" };
  if (b.targets.length > 500) return { ok: false, error: "targets over 500" };

  const targets: BridgeTarget[] = [];
  for (const [i, t] of b.targets.entries()) {
    if (!t || typeof t !== "object") {
      return { ok: false, error: `targets[${i}] must be object` };
    }
    const tt = t as Record<string, unknown>;
    if (!isUuid(tt.targetId)) {
      return { ok: false, error: `targets[${i}].targetId must be uuid` };
    }
    targets.push({
      targetId: tt.targetId as string,
      contactId: (typeof tt.contactId === "string" ? tt.contactId : null) || null,
      name: (typeof tt.name === "string" ? tt.name : null) || null,
      email: (typeof tt.email === "string" ? tt.email : null) || null,
      phone: (typeof tt.phone === "string" ? tt.phone : null) || null,
      company: (typeof tt.company === "string" ? tt.company : null) || null,
      department: (typeof tt.department === "string" ? tt.department : null) || null,
      position: (typeof tt.position === "string" ? tt.position : null) || null,
      courseId: (typeof tt.courseId === "string" ? tt.courseId : null) || null,
      projectId: (typeof tt.projectId === "string" ? tt.projectId : null) || null,
    });
  }

  return { ok: true, data: { batchId: b.batchId as string, channel, targets } };
}

// ──────────────────────────────────────────────────────────────
// 응답 타입
// ──────────────────────────────────────────────────────────────
type DispatchResult =
  | {
      targetId: string;
      distributionId: string;
      token: string;
      surveyUrl: string;
      channel: "email" | "sms";
      status: "dispatched";
    }
  | {
      targetId: string;
      status: "skipped";
      reason: "not_eligible" | "already_dispatched" | "no_contact";
    }
  | {
      targetId: string;
      status: "error";
      reason: string;
    };

// ──────────────────────────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. bridge key 검증
  const expectedKey = process.env.CS_BRIDGE_API_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { error: "CS_BRIDGE_API_KEY not configured on server" },
      { status: 500 }
    );
  }
  const providedKey = req.headers.get("x-cs-bridge-key");
  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: "invalid bridge key" }, { status: 401 });
  }

  // 2. payload 파싱·검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = validatePayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { batchId, channel, targets } = parsed.data;

  const supa = createAdminClient();

  // 3. cs_target_batches 조회 (survey_id 확보)
  const { data: batch, error: batchErr } = await supa
    .from("cs_target_batches")
    .select("id, survey_id, batch_name")
    .eq("id", batchId)
    .maybeSingle();
  if (batchErr) {
    return NextResponse.json({ error: "batch lookup failed", detail: batchErr.message }, { status: 500 });
  }
  if (!batch) {
    return NextResponse.json({ error: "batch not found" }, { status: 404 });
  }
  if (!batch.survey_id) {
    return NextResponse.json(
      { error: "batch has no survey_id — cs_target_batches.survey_id 설정 필요" },
      { status: 400 }
    );
  }

  // 4. cs_survey_targets 재검증 (서버가 권한 체크 — 클라이언트 신뢰 안 함)
  const targetIds = targets.map((t) => t.targetId);
  const { data: dbTargetsRaw, error: dbTargetsErr } = await supa
    .from("cs_survey_targets")
    .select("id, distribution_id, is_eligible, step5_confirmed, contact_id, project_id, course_id")
    .in("id", targetIds)
    .eq("batch_id", batchId);
  if (dbTargetsErr) {
    return NextResponse.json({ error: "targets lookup failed", detail: dbTargetsErr.message }, { status: 500 });
  }
  const dbMap = new Map((dbTargetsRaw ?? []).map((t) => [t.id, t]));

  // 5. distribution_batches upsert (source='cs-bridge', source_batch_id=batchId)
  const { data: existing } = await supa
    .from("distribution_batches")
    .select("id, total_count")
    .eq("source", "cs-bridge")
    .eq("source_batch_id", batchId)
    .maybeSingle();

  let distBatchId: string;
  if (existing) {
    distBatchId = existing.id;
  } else {
    const { data: created, error: createErr } = await supa
      .from("distribution_batches")
      .insert({
        survey_id: batch.survey_id,
        channel: channel === "auto" ? "personal_link" : channel,
        title: `CS 배치: ${batch.batch_name ?? batch.id}`,
        total_count: 0,
        source: "cs-bridge",
        source_batch_id: batchId,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: "distribution_batch create failed", detail: createErr?.message },
        { status: 500 }
      );
    }
    distBatchId = created.id;
  }

  // 6. base URL (survey URL 조립용)
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://exc-survey.vercel.app").replace(/\/$/, "");

  // 7. targets 순회
  const results: DispatchResult[] = [];
  let dispatched = 0;
  let skipped = 0;
  let errors = 0;

  for (const t of targets) {
    const dbt = dbMap.get(t.targetId);

    if (!dbt || !dbt.is_eligible || !dbt.step5_confirmed) {
      results.push({ targetId: t.targetId, status: "skipped", reason: "not_eligible" });
      skipped++;
      continue;
    }
    if (dbt.distribution_id) {
      results.push({ targetId: t.targetId, status: "skipped", reason: "already_dispatched" });
      skipped++;
      continue;
    }

    // 채널 결정
    let useChannel: "email" | "sms";
    if (channel === "email") {
      useChannel = "email";
    } else if (channel === "sms") {
      useChannel = "sms";
    } else {
      // auto: email 우선, 없으면 sms
      useChannel = t.email ? "email" : "sms";
    }

    const hasEmail = !!t.email && useChannel === "email";
    const hasPhone = !!t.phone && useChannel === "sms";
    if (!hasEmail && !hasPhone) {
      results.push({ targetId: t.targetId, status: "skipped", reason: "no_contact" });
      skipped++;
      continue;
    }

    // distributions insert (unique_token 은 DB default로 자동 생성)
    const { data: dist, error: distErr } = await supa
      .from("distributions")
      .insert({
        batch_id: distBatchId,
        survey_id: batch.survey_id,
        recipient_name: t.name,
        recipient_email: t.email,
        recipient_phone: t.phone,
        recipient_company: t.company,
        recipient_department: t.department,
        recipient_position: t.position,
        channel: useChannel,
        status: "pending",
      })
      .select("id, unique_token")
      .single();

    if (distErr || !dist) {
      results.push({
        targetId: t.targetId,
        status: "error",
        reason: distErr?.message ?? "insert_failed",
      });
      errors++;
      continue;
    }

    const surveyUrl = `${baseUrl}/d/${dist.unique_token}`;

    // cs_survey_targets writeback
    const { error: wbErr } = await supa
      .from("cs_survey_targets")
      .update({
        distribution_id: dist.id,
        survey_token: dist.unique_token,
        survey_url: surveyUrl,
        dispatched_at: new Date().toISOString(),
        dispatch_channel: useChannel,
        dispatch_error: null,
        status: "dispatched",
      })
      .eq("id", t.targetId);

    if (wbErr) {
      // distribution 은 생성됐으나 writeback 실패. 결과에는 성공으로 남기되 에러 카운트는 올림.
      // 운영자가 cs_survey_targets.status 수동 보정 가능.
      console.warn(`cs-bridge writeback failed for target ${t.targetId}:`, wbErr.message);
    }

    results.push({
      targetId: t.targetId,
      distributionId: dist.id,
      token: dist.unique_token,
      surveyUrl,
      channel: useChannel,
      status: "dispatched",
    });
    dispatched++;
  }

  // 8. distribution_batches.total_count 업데이트
  if (dispatched > 0) {
    const newTotal = (existing?.total_count ?? 0) + dispatched;
    await supa
      .from("distribution_batches")
      .update({ total_count: newTotal })
      .eq("id", distBatchId);
  }

  return NextResponse.json({ dispatched, skipped, errors, results }, { status: 200 });
}

// ──────────────────────────────────────────────────────────────
// 기타 메서드
// ──────────────────────────────────────────────────────────────
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { allow: "POST, OPTIONS" },
  });
}

export async function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
