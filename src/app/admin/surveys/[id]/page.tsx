import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  Hash,
  MessageSquare,
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
      .select("*")
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

  return {
    survey,
    questions: questions ?? [],
    submissionCount: submissionCount ?? 0,
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

  const { survey, questions, submissionCount } = data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/admin/surveys"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft size={16} />
          설문 목록으로 돌아가기
        </Link>

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
