import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ClipboardList, Plus, ExternalLink, Building2 } from "lucide-react";

export const revalidate = 60;

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-stone-100 text-stone-800" },
  draft: {
    label: "초안",
    className: "border border-stone-300 text-stone-700 bg-white",
  },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getSurveys() {
  const { data: surveys, error } = await supabase
    .from("edu_surveys")
    .select("id, title, status, survey_type, education_type, url_token, starts_at, ends_at, created_at, project_id, projects(id, name, customers(company_name)), edu_submissions(count)")
    .order("created_at", { ascending: false });

  if (error || !surveys) return [];

  return surveys.map((s) => {
    const project = Array.isArray(s.projects) ? s.projects[0] : s.projects;
    const customer = project?.customers
      ? Array.isArray(project.customers)
        ? project.customers[0]
        : project.customers
      : null;
    return {
      ...s,
      submission_count: (s.edu_submissions as unknown as { count: number }[])?.[0]?.count ?? 0,
      project_name: (project as { name?: string } | null)?.name ?? null,
      customer_name: (customer as { company_name?: string } | null)?.company_name ?? null,
    };
  });
}

async function getProjects() {
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");
  return data ?? [];
}

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projectFilter = params.project;
  const [allSurveys, projects] = await Promise.all([getSurveys(), getProjects()]);
  const surveys = projectFilter
    ? allSurveys.filter((s) => s.project_id === projectFilter)
    : allSurveys;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">설문 관리</h1>
          <p className="text-sm text-stone-500 mt-1">
            설문을 생성하고 관리하세요
          </p>
        </div>
        <Link
          href="/admin/quick-create"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} />
          새 설문 만들기
        </Link>
      </div>

      {/* 프로젝트 필터 */}
      {projects.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-stone-400" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href="/admin/surveys"
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !projectFilter
                  ? "bg-teal-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              전체
            </Link>
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/admin/surveys?project=${p.id}`}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  projectFilter === p.id
                    ? "bg-teal-600 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
              <ClipboardList size={24} />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">
            등록된 설문이 없습니다
          </h3>
          <p className="text-sm text-stone-500">
            새 설문을 만들어 보세요.
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
                    프로젝트
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    상태
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    응답 수
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    생성일
                  </th>
                  <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                    관리
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
                        <span className="text-sm font-medium text-stone-800 line-clamp-1">
                          {survey.title}
                        </span>
                      </td>
                      <td className="px-5 h-12">
                        {survey.project_name ? (
                          <span className="text-[13px] text-stone-600 line-clamp-1">
                            {survey.project_name}
                          </span>
                        ) : (
                          <span className="text-[13px] text-stone-400">-</span>
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
                        <span className="text-[13px] text-stone-400 ml-0.5">
                          건
                        </span>
                      </td>
                      <td className="px-5 h-12">
                        <span className="text-[13px] text-stone-500">
                          {formatDate(survey.created_at)}
                        </span>
                      </td>
                      <td className="px-5 h-12">
                        <Link
                          href={`/admin/surveys/${survey.id}`}
                          className="inline-flex items-center gap-1 text-[13px] font-medium text-teal-600 hover:text-teal-700"
                        >
                          상세
                          <ExternalLink size={13} />
                        </Link>
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
