import { createClient } from "@/lib/supabase/server";
import RespondentClient from "./respondent-client";

async function getRespondents(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("respondents")
    .select("*, customers:customer_id(id, company_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

async function getCustomers(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("customers")
    .select("id, company_name")
    .order("company_name", { ascending: true });
  return data ?? [];
}

/**
 * 주소록 각 항목에 대해 발송·응답 이력 카운트 + 최근 응답일 집계.
 * - distributions / edu_submissions: PR #83 이후 시스템 통해 누적된 데이터 (respondent_id 기반).
 * - respondent_cs_history: CSV 로 가져온 과거 응답이력 (CS 설문 외부 집계).
 */
async function getRespondentStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: dists }, { data: subs }, { data: hist }] = await Promise.all([
    supabase
      .from("distributions")
      .select("respondent_id")
      .not("respondent_id", "is", null),
    supabase
      .from("edu_submissions")
      .select("respondent_id, submitted_at, is_test")
      .not("respondent_id", "is", null),
    supabase
      .from("respondent_cs_history")
      .select("respondent_id, responded_month, course_name"),
  ]);

  const sentCount = new Map<string, number>();
  for (const d of dists ?? []) {
    if (!d.respondent_id) continue;
    sentCount.set(d.respondent_id, (sentCount.get(d.respondent_id) ?? 0) + 1);
  }

  const responseCount = new Map<string, number>();
  const lastResponseAt = new Map<string, string>();
  for (const s of subs ?? []) {
    if (!s.respondent_id || s.is_test) continue;
    responseCount.set(s.respondent_id, (responseCount.get(s.respondent_id) ?? 0) + 1);
    if (s.submitted_at) {
      const prev = lastResponseAt.get(s.respondent_id);
      if (!prev || s.submitted_at > prev) {
        lastResponseAt.set(s.respondent_id, s.submitted_at);
      }
    }
  }

  // 과거 응답이력 (CSV 임포트 기반)
  const historyCount = new Map<string, number>();
  const historyLatestMonth = new Map<string, string>();
  const historyLatestCourse = new Map<string, string>();
  for (const h of hist ?? []) {
    if (!h.respondent_id) continue;
    historyCount.set(h.respondent_id, (historyCount.get(h.respondent_id) ?? 0) + 1);
    const m = h.responded_month as string | null;
    if (m) {
      const prev = historyLatestMonth.get(h.respondent_id);
      if (!prev || m > prev) {
        historyLatestMonth.set(h.respondent_id, m);
        if (h.course_name) historyLatestCourse.set(h.respondent_id, h.course_name);
      }
    }
  }

  return {
    sentCount,
    responseCount,
    lastResponseAt,
    historyCount,
    historyLatestMonth,
    historyLatestCourse,
  };
}

export default async function RespondentsPage() {
  const supabase = await createClient();
  const [respondents, customers, stats] = await Promise.all([
    getRespondents(supabase),
    getCustomers(supabase),
    getRespondentStats(supabase),
  ]);

  // 서버에서 카운트 merge 해서 client 로 전달 → client 는 직렬화된 primitive 만 다룸
  const respondentsWithStats = respondents.map((r) => ({
    ...r,
    sent_count: stats.sentCount.get(r.id) ?? 0,
    response_count: stats.responseCount.get(r.id) ?? 0,
    last_response_at: stats.lastResponseAt.get(r.id) ?? null,
    history_count: stats.historyCount.get(r.id) ?? 0,
    history_latest_month: stats.historyLatestMonth.get(r.id) ?? null,
    history_latest_course: stats.historyLatestCourse.get(r.id) ?? null,
  }));

  return <RespondentClient respondents={respondentsWithStats} customers={customers} />;
}
