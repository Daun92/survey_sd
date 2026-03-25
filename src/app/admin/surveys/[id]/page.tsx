import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Calendar,
  Hash,
  MessageSquare,
  ClipboardList,
  Send,
} from "lucide-react";
import SurveyEditor from "./SurveyEditor";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getSurveyDetail(id: string) {
  const [
    { data: survey, error: surveyError },
    { data: questions },
    { count: submissionCount },
  ] = await Promise.all([
    supabase
      .from("edu_surveys")
      .select(`
        *,
        sessions (
          id, name,
          courses (
            id, name,
            projects (
              id, name,
              customers ( id, company_name )
            )
          )
        )
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("edu_questions")
      .select("*")
      .eq("survey_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("edu_submissions")
      .select("*", { count: "exact", head: true })
      .eq("survey_id", id),
  ]);

  if (surveyError || !survey) return null;

  // 프로젝트/고객사 정보 추출
  const session = survey.sessions as any;
  const course = session?.courses;
  const project = course?.projects;
  const customer = project?.customers;

  return {
    survey,
    questions: questions ?? [],
    submissionCount: submissionCount ?? 0,
    projectContext: {
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      customerName: customer?.company_name ?? null,
    },
  };
}

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSurveyDetail(id);

  if (!data) {
    notFound();
  }

  const { survey, questions, submissionCount, projectContext } = data;

  return (
    <div>
      {/* 브레드크럼 + 메타 정보 */}
      <div className="mb-5">
        <nav className="flex items-center gap-1.5 text-[13px] text-stone-400 mb-3">
          <Link href="/admin/projects" className="hover:text-stone-600 transition-colors">
            프로젝트
          </Link>
          {projectContext.projectId && (
            <>
              <ChevronRight size={12} />
              <Link
                href={`/admin/projects/${projectContext.projectId}`}
                className="hover:text-stone-600 transition-colors"
              >
                {projectContext.customerName && (
                  <span className="text-stone-500">{projectContext.customerName} · </span>
                )}
                {projectContext.projectName || "프로젝트"}
              </Link>
            </>
          )}
          <ChevronRight size={12} />
          <span className="text-stone-600 font-medium">{survey.title}</span>
        </nav>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {survey.survey_type && (
              <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                <ClipboardList size={14} className="text-stone-400" />
                {survey.survey_type}
              </div>
            )}
            {survey.education_type && (
              <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                <Hash size={14} className="text-stone-400" />
                {survey.education_type}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
              <Calendar size={14} className="text-stone-400" />
              {formatDate(survey.starts_at)} ~ {formatDate(survey.ends_at)}
            </div>
            <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
              <MessageSquare size={14} className="text-stone-400" />
              응답 {submissionCount}건
            </div>
          </div>

          <Link
            href="/admin/distribute"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Send size={13} />
            배포하기
          </Link>
        </div>
      </div>

      <SurveyEditor
        survey={survey}
        questions={questions}
        submissionCount={submissionCount}
      />
    </div>
  );
}
