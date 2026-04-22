import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  User,
  Hash,
  StickyNote,
} from "lucide-react";
import { ProjectActions } from "./ProjectActions";
import { SessionManager } from "./SessionManager";
import { supabaseError } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "완료", className: "bg-rose-100 text-rose-800" },
  draft: {
    label: "준비중",
    className: "border border-stone-200 text-stone-700 bg-white",
  },
};


async function getProjectDetail(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const [
    { data: project, error: projectError },
    { data: courses },
    { data: surveys },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, customers(id, company_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("courses")
      .select("id, name, education_type, sessions(id, session_number, name, start_date, end_date, capacity, status)")
      .eq("project_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("edu_surveys")
      .select("id, title, status, url_token, starts_at, ends_at, session_id, sessions(session_number, name, courses(name))")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (projectError) {
    if (projectError.code === "PGRST116") return null; // → notFound() in caller
    throw supabaseError(projectError, "프로젝트 정보를 불러오지 못했습니다");
  }
  if (!project) return null;

  return {
    project,
    courses: courses ?? [],
    surveys: surveys ?? [],
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;
  const data = await getProjectDetail(supabase, id);

  if (!data) {
    notFound();
  }

  const { project, courses, surveys } = data;
  const status = statusLabels[project.status] ?? statusLabels.draft;
  const customer = Array.isArray(project.customers)
    ? project.customers[0]
    : project.customers;

  const sessionCount = courses.reduce(
    (sum: number, c: { sessions?: { id: string }[] }) =>
      sum + (Array.isArray(c.sessions) ? c.sessions.length : 0),
    0
  );

  // surveys를 SessionManager에 전달할 형태로 변환
  const surveyItems = surveys.map((s: any) => ({
    id: s.id as string,
    title: s.title as string,
    status: s.status as string,
    url_token: s.url_token as string | null,
    starts_at: s.starts_at as string | null,
    ends_at: s.ends_at as string | null,
    session_id: s.session_id as string | null,
  }));

  return (
    <div>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft size={16} />
          프로젝트 목록으로 돌아가기
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-start gap-3 mb-2">
              <h1 className="text-2xl font-bold text-stone-800">
                {project.name}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1.5 shrink-0 ${status.className}`}
              >
                {status.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3">
              {customer?.company_name && (
                <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                  <Building2 size={14} className="text-stone-400" />
                  {customer.company_name}
                </div>
              )}
              {project.bris_code && (
                <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                  <Hash size={14} className="text-stone-400" />
                  <span className="font-mono">{project.bris_code}</span>
                </div>
              )}
              {project.am_name && (
                <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                  <User size={14} className="text-stone-400" />
                  {project.am_name}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                <Calendar size={14} className="text-stone-400" />
                {formatDate(project.start_date)} ~ {formatDate(project.end_date)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">과정</p>
          <p className="text-2xl font-bold text-stone-800">{courses.length}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">세션</p>
          <p className="text-2xl font-bold text-stone-800">{sessionCount}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">설문</p>
          <p className="text-2xl font-bold text-teal-600">{surveys.length}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">유형</p>
          <p className="text-2xl font-bold text-stone-800">
            {project.project_type === "education"
              ? "교육"
              : project.project_type === "consulting"
                ? "컨설팅"
                : "기타"}
          </p>
        </div>
      </div>

      {/* Notes */}
      {project.notes && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote size={14} className="text-stone-400" />
            <h2 className="text-sm font-semibold text-stone-900">메모</h2>
          </div>
          <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">
            {project.notes}
          </p>
        </div>
      )}

      {/* Edit / Delete Actions */}
      <div className="mb-8">
        <ProjectActions project={project} />
      </div>

      {/* 통합 트리: 과정 · 세션 · 설문 */}
      <SessionManager
        projectId={project.id}
        courses={courses as { id: string; name: string; education_type: string | null; sessions: { id: string; session_number: number; name: string | null; start_date: string | null; end_date: string | null; capacity: number | null; status: string }[] }[]}
        surveys={surveyItems}
      />
    </div>
  );
}
