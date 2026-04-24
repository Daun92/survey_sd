import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart3,
  FileBarChart,
  ChevronLeft,
  Inbox,
  Download,
} from "lucide-react";
import { ReportTabs, type SurveyReportData } from "./ReportTabs";
import {
  aggregateSurveyReport,
  type ReportSubmission,
  type ReportQuestion,
} from "@/lib/report-aggregator";

async function getSurveyReport(surveyId: string): Promise<SurveyReportData | null> {
  const supabase = await createClient();
  const { data: survey } = await supabase
    .from("edu_surveys")
    .select("id, title, status, created_at")
    .eq("id", surveyId)
    .single();

  if (!survey) return null;

  const [{ data: submissions }, { data: questions }] = await Promise.all([
    supabase
      .from("edu_submissions")
      .select("id, total_score, answers, respondent_name, respondent_department, respondent_position, channel, created_at")
      .eq("survey_id", surveyId)
      .eq("is_test", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("edu_questions")
      .select("id, question_text, question_type, question_code, section, sort_order")
      .eq("survey_id", surveyId)
      .order("sort_order", { ascending: true }),
  ]);

  const aggregation = aggregateSurveyReport(
    (submissions ?? []) as ReportSubmission[],
    (questions ?? []) as ReportQuestion[],
  );

  return {
    id: survey.id,
    title: survey.title,
    status: survey.status,
    created_at: survey.created_at,
    ...aggregation,
  };
}

async function getSurveyList() {
  const supabase = await createClient();
  const { data: surveys } = await supabase
    .from("edu_surveys")
    .select("id, title, status, created_at, edu_submissions(count)")
    .order("created_at", { ascending: false });

  if (!surveys || surveys.length === 0) return [];

  return surveys.map((sv) => ({
    ...sv,
    submissionCount: (sv.edu_submissions as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: { label: "초안", className: "border border-stone-200 text-stone-700" },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ survey?: string }>;
}) {
  const params = await searchParams;
  const surveyId = params.survey;

  if (surveyId) {
    const report = await getSurveyReport(surveyId);

    if (!report) {
      return (
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
            <p className="text-sm text-stone-500 mt-1">
              교육 설문 결과를 분석하세요
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
            <p className="text-sm text-stone-500">
              해당 설문을 찾을 수 없습니다.
            </p>
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 mt-4"
            >
              <ChevronLeft size={16} />
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* 헤더 */}
        <div className="mb-8">
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 mb-4"
          >
            <ChevronLeft size={16} />
            목록으로 돌아가기
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
              <p className="text-sm text-stone-500 mt-1">
                교육 설문 결과를 분석하세요
              </p>
            </div>
            <a
              href={`/api/surveys/${report.id}/export`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              CSV 내보내기
            </a>
          </div>
        </div>

        <ReportTabs data={report} />
      </div>
    );
  }

  // Survey list view
  const surveys = await getSurveyList();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
        <p className="text-sm text-stone-500 mt-1">
          교육 설문 결과를 분석하세요
        </p>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <Inbox size={24} className="text-stone-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">
            설문이 없습니다
          </h3>
          <p className="text-sm text-stone-500">
            리포트를 생성할 설문이 아직 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey) => {
            const status = statusLabels[survey.status] ?? statusLabels.draft;
            return (
              <div
                key={survey.id}
                className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                      <BarChart3 size={16} />
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-stone-800 mb-1 truncate">
                    {survey.title}
                  </h3>
                  <p className="text-xs text-stone-400 mb-4">
                    {formatDate(survey.created_at)}
                  </p>

                  <div className="flex items-center gap-4 mb-4">
                    <div>
                      <p className="text-lg font-bold text-stone-800">
                        {survey.submissionCount}
                      </p>
                      <p className="text-xs text-stone-500">응답 수</p>
                    </div>
                  </div>

                  <Link
                    href={`/admin/reports?survey=${survey.id}`}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
                  >
                    <FileBarChart size={14} />
                    보고서 생성
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
