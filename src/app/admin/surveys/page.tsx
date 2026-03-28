import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  ExternalLink,
  Search,
  Eye,
  Send,
  ChartColumn,
} from "lucide-react";

export const revalidate = 60;

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: {
    label: "초안",
    className: "border border-stone-200 text-stone-700 bg-white",
  },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getSurveys(statusFilter?: string, query?: string) {
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
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    q = q.eq("status", statusFilter);
  }

  const { data: surveys, error } = await q;

  if (error || !surveys) return [];

  let result = surveys.map((s: any) => {
    const session = s.sessions;
    const course = session?.courses;
    const project = course?.projects;
    const customer = project?.customers;

    return {
      id: s.id,
      title: s.title,
      status: s.status,
      survey_type: s.survey_type,
      url_token: s.url_token,
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
  // 상태별 count를 병렬로 조회 (전체 row를 가져오지 않음)
  const [total, active, closed, draft] = await Promise.all([
    supabase.from("edu_surveys").select("*", { count: "exact", head: true }),
    supabase.from("edu_surveys").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("edu_surveys").select("*", { count: "exact", head: true }).eq("status", "closed"),
    supabase.from("edu_surveys").select("*", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  return {
    all: total.count ?? 0,
    active: active.count ?? 0,
    closed: closed.count ?? 0,
    draft: draft.count ?? 0,
  };
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

      {/* 상태 필터 탭 + 검색 */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            const href =
              tab.key === "all"
                ? `/admin/surveys${query ? `?q=${query}` : ""}`
                : `/admin/surveys?status=${tab.key}${query ? `&q=${query}` : ""}`;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs ${isActive ? "text-stone-400" : "text-stone-400"}`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>

        <form action="/admin/surveys" method="get" className="relative">
          {statusFilter !== "all" && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="설문 검색..."
            className="w-56 rounded-lg border border-stone-200 bg-white pl-9 pr-3 py-2 text-sm text-stone-700 placeholder-stone-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          />
        </form>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
              <ClipboardList size={24} />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">
            {query ? "검색 결과가 없습니다" : "등록된 설문이 없습니다"}
          </h3>
          <p className="text-sm text-stone-500">
            {query ? "다른 검색어를 시도해 보세요." : "새 설문을 만들어 보세요."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-100">
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    설문명
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    유형
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    고객사 / 프로젝트
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    상태
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    응답
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    생성일
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody>
                {surveys.map((survey) => {
                  const status =
                    statusLabels[survey.status] ?? statusLabels.draft;
                  return (
                    <tr
                      key={survey.id}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors"
                    >
                      <td className="px-5 h-12">
                        <Link
                          href={`/admin/surveys/${survey.id}`}
                          className="text-sm font-medium text-stone-800 hover:text-teal-600 transition-colors line-clamp-1"
                        >
                          {survey.title}
                        </Link>
                      </td>
                      <td className="px-5 h-12">
                        {survey.survey_type && (
                          <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                            {survey.survey_type}
                          </span>
                        )}
                      </td>
                      <td className="px-5 h-12">
                        <div className="text-sm text-stone-700 line-clamp-1">
                          {survey.customer_name ?? "-"}
                        </div>
                        {survey.project_name && (
                          <div className="text-[11px] text-stone-400 line-clamp-1">
                            {survey.project_name}
                          </div>
                        )}
                      </td>
                      <td className="px-5 h-12">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 h-12">
                        <span className="text-sm font-medium text-stone-700">
                          {survey.submission_count}
                        </span>
                      </td>
                      <td className="px-5 h-12">
                        <span className="text-[13px] text-stone-500">
                          {formatDate(survey.created_at)}
                        </span>
                      </td>
                      <td className="px-5 h-12">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/admin/surveys/${survey.id}`}
                            className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                            title="상세 보기"
                          >
                            <Eye size={15} />
                          </Link>
                          {survey.status === "active" && (
                            <Link
                              href="/admin/distribute"
                              className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                              title="배포"
                            >
                              <Send size={15} />
                            </Link>
                          )}
                          {survey.submission_count > 0 && (
                            <Link
                              href={`/admin/responses?survey=${survey.id}`}
                              className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                              title="리포트"
                            >
                              <ChartColumn size={15} />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
