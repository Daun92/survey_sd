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

export const dynamic = "force-dynamic";

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-stone-100 text-stone-800" },
  draft: {
    label: "초안",
    className: "border border-stone-300 text-stone-700 bg-white",
  },
};

const questionTypeLabels: Record<string, string> = {
  likert: "리커트 척도",
  text: "주관식",
  multiple_choice: "객관식",
  rating: "평점",
  yes_no: "예/아니오",
};

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
  const status = statusLabels[survey.status] ?? statusLabels.draft;

  // Group questions by section
  const sections: Record<string, typeof questions> = {};
  questions.forEach((q) => {
    const section = q.section || "기타";
    if (!sections[section]) sections[section] = [];
    sections[section].push(q);
  });

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/surveys"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft size={16} />
          설문 목록으로 돌아가기
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-start gap-3 mb-2">
          <h1 className="text-2xl font-bold text-stone-800">
            {survey.title}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1.5 shrink-0 ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-3">
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

      {/* Submission Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">
            총 문항 수
          </p>
          <p className="text-2xl font-bold text-stone-800">
            {questions.length}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">
            총 응답 수
          </p>
          <p className="text-2xl font-bold text-teal-600">
            {submissionCount}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">
            섹션 수
          </p>
          <p className="text-2xl font-bold text-stone-800">
            {Object.keys(sections).length}
          </p>
        </div>
      </div>

      {/* Questions List */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="p-5 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">
            설문 문항
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            총 {questions.length}개 문항
          </p>
        </div>

        {questions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                <ClipboardList size={24} />
              </div>
            </div>
            <h3 className="text-sm font-medium text-stone-800 mb-1">
              등록된 문항이 없습니다
            </h3>
            <p className="text-sm text-stone-500">
              설문 문항을 추가해 주세요.
            </p>
          </div>
        ) : (
          <div>
            {Object.entries(sections).map(
              ([sectionName, sectionQuestions]) => (
                <div key={sectionName}>
                  <div className="px-5 py-2.5 bg-stone-50/80 border-b border-stone-100">
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                      {sectionName}
                    </span>
                    <span className="text-xs text-stone-400 ml-2">
                      ({sectionQuestions.length}문항)
                    </span>
                  </div>
                  {sectionQuestions.map((question, idx) => (
                    <div
                      key={question.id}
                      className="flex items-start gap-4 px-5 py-3.5 border-b border-stone-100 last:border-0"
                    >
                      <span className="text-xs font-mono text-stone-400 mt-0.5 shrink-0 w-16">
                        {question.question_code || `Q${idx + 1}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800 leading-relaxed">
                          {question.question_text}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 shrink-0">
                        {questionTypeLabels[question.question_type] ??
                          question.question_type}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
