import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SurveyToolbar, type SurveyItem } from "./survey-toolbar";

export const revalidate = 60;

async function getSurveys(statusFilter?: string, query?: string): Promise<SurveyItem[]> {
  let q = supabase
    .from("edu_surveys")
    .select(`
      id, title, status, survey_type, education_type, url_token,
      starts_at, ends_at, created_at,
      edu_submissions(count),
      sessions (
        name,
        courses (
          name,
          projects (
            name,
            customers ( company_name )
          )
        )
      )
    `)
    .order("starts_at", { ascending: false, nullsFirst: false });

  if (statusFilter && statusFilter !== "all") {
    q = q.eq("status", statusFilter);
  }

  const { data: surveys, error } = await q;

  if (error || !surveys) return [];

  // Track 1: 날짜 기반 자동 상태 전환
  const now = new Date().toISOString();
  for (const s of surveys as any[]) {
    if (s.status === "draft" && s.starts_at && s.starts_at <= now) {
      await supabase.from("edu_surveys").update({ status: "active", updated_at: now }).eq("id", s.id);
      s.status = "active";
    } else if (s.status === "active" && s.ends_at && s.ends_at <= now) {
      await supabase.from("edu_surveys").update({ status: "closed", updated_at: now }).eq("id", s.id);
      s.status = "closed";
    }
  }

  let result = surveys.map((s: any) => {
    const session = s.sessions;
    const course = session?.courses;
    const project = course?.projects;
    const customer = project?.customers;

    return {
      id: s.id,
      title: s.title,
      status: s.status as string,
      url_token: s.url_token,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      created_at: s.created_at,
      project_name: project?.name ?? null,
      customer_name: customer?.company_name ?? null,
      session_name: session?.name ?? null,
      submission_count:
        (s.edu_submissions as unknown as { count: number }[])?.[0]?.count ?? 0,
    };
  });

  if (query) {
    const lower = query.toLowerCase();
    result = result.filter(
      (s) =>
        s.title.toLowerCase().includes(lower) ||
        (s.project_name && s.project_name.toLowerCase().includes(lower)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(lower))
    );
  }

  return result;
}

async function getStatusCounts() {
  const { data } = await supabase
    .from("edu_surveys")
    .select("status");

  const counts: Record<string, number> = { all: 0, active: 0, closed: 0, draft: 0 };
  (data ?? []).forEach((s: { status: string }) => {
    counts.all += 1;
    if (counts[s.status] !== undefined) counts[s.status] += 1;
  });
  return counts;
}

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status || "all";
  const query = params.q || "";

  const [surveys, counts] = await Promise.all([
    getSurveys(statusFilter, query),
    getStatusCounts(),
  ]);

  const tabs = [
    { key: "all", label: "전체", count: counts.all },
    { key: "active", label: "진행중", count: counts.active },
    { key: "closed", label: "마감", count: counts.closed },
    { key: "draft", label: "초안", count: counts.draft },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">설문 관리</h1>
          <p className="text-sm text-stone-500 mt-1">
            설문을 생성, 관리하고 배포하세요
          </p>
        </div>
        <Link
          href="/admin/quick-create"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} />
          새 설문
        </Link>
      </div>

      <SurveyToolbar
        surveys={surveys}
        query={query}
        tabs={tabs}
        statusFilter={statusFilter}
      />
    </div>
  );
}
