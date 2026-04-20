import { createClient } from "@/lib/supabase/server";
import RespondentClient from "./respondent-client";

export const revalidate = 30;

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
 * respondent_id 기반 — PR #83 이후 누적되는 데이터만 반영된다(그 이전 제출은 대부분 null).
 */
async function getRespondentStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: dists }, { data: subs }] = await Promise.all([
    supabase
      .from("distributions")
      .select("respondent_id")
      .not("respondent_id", "is", null),
    supabase
      .from("edu_submissions")
      .select("respondent_id, submitted_at, is_test")
      .not("respondent_id", "is", null),
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

  return { sentCount, responseCount, lastResponseAt };
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
  }));

  return <RespondentClient respondents={respondentsWithStats} customers={customers} />;
}
