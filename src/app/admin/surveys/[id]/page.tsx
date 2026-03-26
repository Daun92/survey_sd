import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  Hash,
  MessageSquare,
  Link2,
  ExternalLink,
  QrCode,
} from "lucide-react";
import SurveyEditor from "./SurveyEditor";
import { CopyUrlButton } from "./CopyUrlButton";

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

      {/* 배포 링크 섹션 */}
      {survey.url_token && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-6">
          <div className="p-5">
            <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-2">
              <QrCode size={16} className="text-teal-600" />
              배포 링크
            </h3>
            <div className="flex items-center gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
              <Link2 size={14} className="text-stone-400 shrink-0" />
              <span className="text-sm text-stone-600 truncate font-mono flex-1">
                /survey/{survey.url_token}
              </span>
              <CopyUrlButton urlToken={survey.url_token} />
              <a
                href={`/survey/${survey.url_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                title="새 탭에서 열기"
              >
                <ExternalLink size={12} />
              </a>
            </div>
            <div className="mt-3 flex items-center justify-center">
              <div className="flex items-center justify-center w-28 h-28 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50">
                <div className="text-center">
                  <QrCode size={28} className="text-stone-300 mx-auto mb-1" />
                  <span className="text-[11px] text-stone-400">QR Code</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SurveyEditor
        survey={survey}
        questions={questions}
        submissionCount={submissionCount}
      />
    </div>
  );
}
