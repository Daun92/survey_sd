import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Calendar,
  Hash,
  MessageSquare,
  ClipboardList,
} from "lucide-react";
import SurveyEditor from "./SurveyEditor";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getSurveyDetail(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
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

  if (surveyError || !survey) {
    console.error("[surveys/[id]] Supabase error:", surveyError);
    return null;
  }

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
  const supabase = await createClient();
  const { id } = await params;
  const data = await getSurveyDetail(supabase, id);

  if (!data) {
    notFound();
  }

  const { survey, questions, submissionCount, projectContext } = data;

  return (
    <div>
      {/* 브레드크럼 + 메타 정보 */}
      <div className="mb-5">
        <nav className="flex items-center gap-1.5 text-[13px] text-stone-400 mb-3">
          <Link href="/admin/surveys" className="hover:text-stone-600 transition-colors">
            설문 관리
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
      </div>

      <SurveyEditor
        survey={survey}
        questions={questions}
        submissionCount={submissionCount}
      />
    </div>
  );
}
