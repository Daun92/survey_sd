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
  BookOpen,
  Users,
  ClipboardList,
  FolderOpen,
  StickyNote,
  Plus,
} from "lucide-react";
import { ProjectActions } from "./ProjectActions";
import { SessionManager } from "./SessionManager";

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

  if (projectError || !project) {
    console.error("[projects/[id]] Supabase error:", projectError);
    return null;
  }

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

  // 세션별 설문 수 계산 (SessionManager 삭제 안전장치용)
  const sessionSurveyCounts: Record<string, number> = {};
  for (const s of surveys) {
    if (s.session_id) {
      sessionSurveyCounts[s.session_id] = (sessionSurveyCounts[s.session_id] || 0) + 1;
    }
  }

  // 설문을 과정 > 세션 트리 구조로 그룹핑
  type SurveyItem = typeof surveys[number];
  const sessionToCourse = new Map<string, { courseId: string; courseName: string; educationType: string | null }>();
  for (const course of courses) {
    const sessions = Array.isArray(course.sessions) ? course.sessions : [];
    for (const session of sessions) {
      sessionToCourse.set(session.id, {
        courseId: course.id,
        courseName: course.name,
        educationType: course.education_type,
      });
    }
  }

  // 과정별 → 세션별 → 설문 그룹
  const courseGroups = new Map<string, {
    courseName: string;
    educationType: string | null;
    sessions: Map<string, { sessionNumber: number; sessionName: string | null; surveys: SurveyItem[] }>;
  }>();
  const ungrouped: SurveyItem[] = [];

  for (const survey of surveys) {
    if (!survey.session_id) {
      ungrouped.push(survey);
      continue;
    }
    const courseInfo = sessionToCourse.get(survey.session_id);
    if (!courseInfo) {
      ungrouped.push(survey);
      continue;
    }
    if (!courseGroups.has(courseInfo.courseId)) {
      courseGroups.set(courseInfo.courseId, {
        courseName: courseInfo.courseName,
        educationType: courseInfo.educationType,
        sessions: new Map(),
      });
    }
    const group = courseGroups.get(courseInfo.courseId)!;
    if (!group.sessions.has(survey.session_id)) {
      const session = Array.isArray(survey.sessions) ? survey.sessions[0] : null;
      group.sessions.set(survey.session_id, {
        sessionNumber: session?.session_number ?? 0,
        sessionName: session?.name ?? null,
        surveys: [],
      });
    }
    group.sessions.get(survey.session_id)!.surveys.push(survey);
  }

  const educationTypeLabels: Record<string, string> = {
    classroom: "집합",
    remote: "원격",
    elearning: "이러닝",
    blended: "혼합",
  };

  const sortedCourseGroups = [...courseGroups.entries()].sort((a, b) =>
    a[1].courseName.localeCompare(b[1].courseName)
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

      {/* Courses & Sessions — Interactive Manager */}
      <SessionManager
        projectId={project.id}
        courses={courses as { id: string; name: string; education_type: string | null; sessions: { id: string; session_number: number; name: string | null; start_date: string | null; end_date: string | null; capacity: number | null; status: string }[] }[]}
        sessionSurveyCounts={sessionSurveyCounts}
      />

      {/* Surveys — 과정 > 세션 트리 구조 */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">설문 목록</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              총 {surveys.length}개 설문
            </p>
          </div>
          <Link
            href={`/admin/quick-create?project=${project.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Plus size={13} />
            설문 추가
          </Link>
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
          <div className="divide-y divide-stone-100">
            {/* 과정별 그룹 */}
            {sortedCourseGroups.map(([courseId, group]) => (
              <div key={courseId}>
                {/* 과정 헤더 */}
                <div className="px-5 py-3 bg-stone-50/80 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <FolderOpen size={15} className="text-indigo-500" />
                    <span className="text-sm font-semibold text-stone-800">
                      {group.courseName}
                    </span>
                    {group.educationType && (
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600">
                        {educationTypeLabels[group.educationType] ?? group.educationType}
                      </span>
                    )}
                    <span className="text-[11px] text-stone-400">
                      {[...group.sessions.values()].reduce((sum, s) => sum + s.surveys.length, 0)}개 설문
                    </span>
                  </div>
                </div>
                {/* 세션별 서브그룹 */}
                {[...group.sessions.entries()]
                  .sort((a, b) => a[1].sessionNumber - b[1].sessionNumber)
                  .map(([sessionId, sessionGroup]) => (
                    <div key={sessionId}>
                      {/* 세션 서브헤더 */}
                      <div className="px-5 py-2 pl-10 bg-stone-50/40 border-b border-stone-50">
                        <div className="flex items-center gap-1.5">
                          <BookOpen size={12} className="text-stone-400" />
                          <span className="text-xs font-medium text-stone-600">
                            제{sessionGroup.sessionNumber}차
                            {sessionGroup.sessionName ? ` · ${sessionGroup.sessionName}` : ""}
                          </span>
                          <span className="text-[11px] text-stone-400">
                            ({sessionGroup.surveys.length}개)
                          </span>
                        </div>
                      </div>
                      {/* 설문 행 */}
                      {sessionGroup.surveys.map((survey) => {
                        const sStatus =
                          surveyStatusLabels[survey.status] ?? surveyStatusLabels.draft;
                        return (
                          <Link
                            key={survey.id}
                            href={`/admin/surveys/${survey.id}`}
                            className="flex items-center gap-4 px-5 pl-14 py-3.5 border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors"
                          >
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
                              <ClipboardList size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-800 truncate">
                                {survey.title}
                              </p>
                              <span className="text-xs text-stone-400">
                                {formatDate(survey.starts_at)} ~ {formatDate(survey.ends_at)}
                              </span>
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${sStatus.className}`}
                            >
                              {sStatus.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
              </div>
            ))}

            {/* 미분류 (세션 미연결) 설문 */}
            {ungrouped.length > 0 && (
              <div>
                <div className="px-5 py-3 bg-amber-50/60 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={15} className="text-amber-500" />
                    <span className="text-sm font-semibold text-stone-700">
                      미분류
                    </span>
                    <span className="text-[11px] text-stone-400">
                      세션 미연결 · {ungrouped.length}개 설문
                    </span>
                  </div>
                </div>
                {ungrouped.map((survey) => {
                  const sStatus =
                    surveyStatusLabels[survey.status] ?? surveyStatusLabels.draft;
                  return (
                    <Link
                      key={survey.id}
                      href={`/admin/surveys/${survey.id}`}
                      className="flex items-center gap-4 px-5 pl-10 py-3.5 border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
                        <ClipboardList size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">
                          {survey.title}
                        </p>
                        <span className="text-xs text-stone-400">
                          {formatDate(survey.starts_at)} ~ {formatDate(survey.ends_at)}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${sStatus.className}`}
                      >
                        {sStatus.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
