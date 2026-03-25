import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  User,
  Hash,
  BookOpen,
  Users,
  ClipboardList,
  FolderOpen,
  StickyNote,
} from "lucide-react";
import { ProjectActions } from "./ProjectActions";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "완료", className: "bg-rose-100 text-rose-800" },
  draft: {
    label: "준비중",
    className: "border border-stone-200 text-stone-700 bg-white",
  },
};

const surveyStatusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: {
    label: "초안",
    className: "border border-stone-200 text-stone-700 bg-white",
  },
};

const sessionStatusLabels: Record<string, { label: string; className: string }> = {
  scheduled: { label: "예정", className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "완료", className: "bg-rose-100 text-rose-800" },
  cancelled: { label: "취소", className: "bg-red-100 text-red-800" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getProjectDetail(id: string) {
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
      .select("id, title, status, url_token, starts_at, ends_at, session_id")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (projectError || !project) return null;

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
  const { id } = await params;
  const data = await getProjectDetail(id);

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

      {/* Courses & Sessions */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-8">
        <div className="p-5 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">과정 및 세션</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            총 {courses.length}개 과정, {sessionCount}개 세션
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                <BookOpen size={24} />
              </div>
            </div>
            <h3 className="text-sm font-medium text-stone-800 mb-1">
              등록된 과정이 없습니다
            </h3>
            <p className="text-sm text-stone-500">
              이 프로젝트에 과정을 추가해 주세요.
            </p>
          </div>
        ) : (
          <div>
            {courses.map((course) => {
              const sessions = Array.isArray(course.sessions)
                ? course.sessions
                : [];
              return (
                <div key={course.id}>
                  <div className="px-5 py-2.5 bg-stone-50/80 border-b border-stone-100">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-teal-600" />
                      <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                        {course.name}
                      </span>
                      <span className="text-xs text-stone-400 ml-1">
                        ({sessions.length}세션)
                      </span>
                      {course.education_type && (
                        <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                          {course.education_type === "classroom"
                            ? "집합"
                            : course.education_type === "online"
                              ? "온라인"
                              : course.education_type}
                        </span>
                      )}
                    </div>
                  </div>
                  {sessions.length === 0 ? (
                    <div className="px-5 py-3 text-sm text-stone-400 border-b border-stone-100">
                      등록된 세션이 없습니다.
                    </div>
                  ) : (
                    sessions
                      .sort(
                        (a: { session_number: number }, b: { session_number: number }) =>
                          a.session_number - b.session_number
                      )
                      .map(
                        (session: {
                          id: string;
                          session_number: number;
                          name: string | null;
                          start_date: string | null;
                          end_date: string | null;
                          capacity: number | null;
                          status: string;
                        }) => {
                          const sStatus =
                            sessionStatusLabels[session.status] ??
                            sessionStatusLabels.scheduled;
                          return (
                            <div
                              key={session.id}
                              className="flex items-center gap-4 px-5 py-3 border-b border-stone-100 last:border-0"
                            >
                              <span className="text-xs font-mono text-stone-400 shrink-0 w-12">
                                #{session.session_number}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-stone-800">
                                  {session.name || `세션 ${session.session_number}`}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-xs text-stone-400">
                                    {formatDate(session.start_date)} ~{" "}
                                    {formatDate(session.end_date)}
                                  </span>
                                  {session.capacity && (
                                    <span className="flex items-center gap-1 text-xs text-stone-400">
                                      <Users size={11} />
                                      {session.capacity}명
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${sStatus.className}`}
                              >
                                {sStatus.label}
                              </span>
                            </div>
                          );
                        }
                      )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Surveys */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="p-5 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">설문 목록</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            총 {surveys.length}개 설문
          </p>
        </div>

        {surveys.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                <ClipboardList size={24} />
              </div>
            </div>
            <h3 className="text-sm font-medium text-stone-800 mb-1">
              등록된 설문이 없습니다
            </h3>
            <p className="text-sm text-stone-500">
              이 프로젝트에 설문을 추가해 주세요.
            </p>
          </div>
        ) : (
          <div>
            {surveys.map(
              (survey: {
                id: string;
                title: string;
                status: string;
                url_token: string | null;
                starts_at: string | null;
                ends_at: string | null;
                session_id: string | null;
              }) => {
                const sStatus =
                  surveyStatusLabels[survey.status] ?? surveyStatusLabels.draft;
                return (
                  <Link
                    key={survey.id}
                    href={`/admin/surveys/${survey.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
                      <ClipboardList size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">
                        {survey.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-stone-400">
                          {formatDate(survey.starts_at)} ~{" "}
                          {formatDate(survey.ends_at)}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${sStatus.className}`}
                    >
                      {sStatus.label}
                    </span>
                  </Link>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
